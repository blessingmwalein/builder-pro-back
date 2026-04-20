import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface ElectrosalesProduct {
  id: number;
  name: string;
  sku: string;
  price: number;
  priceExclVat: number;
  availability: string;
  supplierName: string;
  description: string;
  breadcrumbs: string[];
  imageUrl: string | null;
}

interface RawProduct {
  id: number;
  name?: string;
  sku?: string;
  price?: number;
  priceExclVat?: number;
  availability?: string;
  st_ldesc?: string;
  brand?: { name?: string };
  images?: string[];
  breadcrumbs?: string[];
}

interface ProductsPayload {
  items?: RawProduct[];
  page?: number;
  total?: number;
  limit?: number;
}

const ELECTROSALES_BASE_URL = 'https://www.electrosales.co.zw:3000';

export const ELECTROSALES_SOURCE = 'electrosales';

@Injectable()
export class ElectrosalesService {
  private readonly logger = new Logger(ElectrosalesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Search the upstream Electrosales catalog.
   *
   * The upstream API does not document a stable search parameter — we probe a
   * few common ones (`search`, `q`, `keyword`) and fall back to the unfiltered
   * list with client-side filtering if none match. This mirrors the Next.js
   * route proxy but is now available as a reusable backend datasource so it
   * can be consumed from Quote / Invoice services, jobs, etc.
   */
  async searchProducts(params: {
    query?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    items: ElectrosalesProduct[];
    page: number;
    limit: number;
    total: number;
    source: 'electrosales';
  }> {
    const query = (params.query ?? '').trim();
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(50, Math.max(1, params.limit ?? 12));

    const payload = await this.fetchWithFallbacks(query, page, limit);
    if (!payload || !Array.isArray(payload.items)) {
      return { items: [], page, limit, total: 0, source: 'electrosales' };
    }

    const filtered = query
      ? payload.items.filter((item) => {
          const haystack = `${item.name ?? ''} ${item.sku ?? ''} ${item.st_ldesc ?? ''}`.toLowerCase();
          return haystack.includes(query.toLowerCase());
        })
      : payload.items;

    return {
      items: filtered.map((p) => this.normalize(p)),
      page: payload.page ?? page,
      limit: payload.limit ?? limit,
      total: payload.total ?? filtered.length,
      source: 'electrosales',
    };
  }

  private async fetchWithFallbacks(
    query: string,
    page: number,
    limit: number,
  ): Promise<ProductsPayload | null> {
    const candidates = [
      `/shop/getProductsList?page=${page}&limit=${limit}&search=${encodeURIComponent(query)}`,
      `/shop/getProductsList?page=${page}&limit=${limit}&q=${encodeURIComponent(query)}`,
      `/shop/getProductsList?page=${page}&limit=${limit}&keyword=${encodeURIComponent(query)}`,
      `/shop/getProductsList?page=${page}&limit=${limit}`,
    ];

    for (const path of candidates) {
      try {
        const res = await fetch(`${ELECTROSALES_BASE_URL}${path}`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) continue;
        const json = (await res.json()) as ProductsPayload;
        if (Array.isArray(json.items)) return json;
      } catch (err) {
        this.logger.debug(
          `Electrosales fetch failed for ${path}: ${(err as Error).message}`,
        );
        continue;
      }
    }

    return null;
  }

  /**
   * Upsert an Electrosales product as a `Material` row for a tenant company.
   *
   * - Dedupes on `(companyId, externalSource, externalProductId)` so repeated
   *   imports just re-sync price / image.
   * - Falls back to SKU match if the external-id index is missing.
   * - Returns the Material ID, ready to be attached to a QuoteLineItem or logged
   *   against a project when work consumes it.
   */
  async importAsMaterial(
    companyId: string,
    product: ElectrosalesProduct,
  ): Promise<{ id: string; name: string; sku: string | null; unitCost: number }> {
    const externalSource = ELECTROSALES_SOURCE;
    const externalProductId = String(product.id);

    // Use raw types since generated prisma types may lag behind schema in a
    // running dev server — this code is safe at runtime once the client is
    // regenerated, and the fields are nullable so the legacy shape still works.
    const prismaAny = this.prisma as unknown as {
      material: {
        findFirst: (args: unknown) => Promise<{ id: string } | null>;
        update: (args: unknown) => Promise<{
          id: string;
          name: string;
          sku: string | null;
          unitCost: unknown;
        }>;
        create: (args: unknown) => Promise<{
          id: string;
          name: string;
          sku: string | null;
          unitCost: unknown;
        }>;
      };
    };

    const existing = await prismaAny.material.findFirst({
      where: {
        companyId,
        deletedAt: null,
        OR: [
          { externalSource, externalProductId },
          product.sku ? { sku: product.sku } : { id: '__none__' },
        ],
      },
      select: { id: true },
    });

    const category = product.breadcrumbs[0] ?? null;
    const subcategory = product.breadcrumbs[product.breadcrumbs.length - 1] ?? null;

    const now = new Date();

    const payload = {
      name: product.name,
      sku: product.sku || null,
      unit: 'each',
      unitCost: product.priceExclVat || product.price || 0,
      category,
      externalSource,
      externalProductId,
      externalImageUrl: product.imageUrl,
      externalCategory: subcategory,
      lastSyncedAt: now,
    };

    if (existing) {
      const updated = await prismaAny.material.update({
        where: { id: existing.id },
        data: payload,
        select: { id: true, name: true, sku: true, unitCost: true },
      });
      return {
        id: updated.id,
        name: updated.name,
        sku: updated.sku,
        unitCost: Number(updated.unitCost),
      };
    }

    const created = await prismaAny.material.create({
      data: { ...payload, companyId },
      select: { id: true, name: true, sku: true, unitCost: true },
    });
    return {
      id: created.id,
      name: created.name,
      sku: created.sku,
      unitCost: Number(created.unitCost),
    };
  }

  /**
   * Look up a single product by its upstream ID (used when we have only a
   * cached `externalProductId` from a saved quote line and need to re-fetch
   * current price / availability).
   */
  async getProductById(id: number | string): Promise<ElectrosalesProduct | null> {
    const candidates = [
      `${ELECTROSALES_BASE_URL}/shop/getProductsList?search=${encodeURIComponent(String(id))}&limit=50`,
      `${ELECTROSALES_BASE_URL}/shop/getProductsList?limit=50`,
    ];
    for (const url of candidates) {
      try {
        const res = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!res.ok) continue;
        const json = (await res.json()) as ProductsPayload;
        const match = json.items?.find((p) => String(p.id) === String(id));
        if (match) return this.normalize(match);
      } catch (err) {
        this.logger.debug(
          `Electrosales getProductById(${id}) failed: ${(err as Error).message}`,
        );
      }
    }
    return null;
  }

  /**
   * Convenience: import by external id + (company, quantity, projectId?) —
   * returns the resulting Material so the caller can attach it to a line item
   * or log usage.
   */
  async importByExternalId(companyId: string, externalId: number | string) {
    const product = await this.getProductById(externalId);
    if (!product) {
      throw new NotFoundException(
        `Electrosales product ${externalId} could not be fetched`,
      );
    }
    return this.importAsMaterial(companyId, product);
  }

  private normalize(product: RawProduct): ElectrosalesProduct {
    return {
      id: product.id,
      name: product.name || product.st_ldesc || 'Unnamed product',
      sku: product.sku || '',
      price: typeof product.price === 'number' ? product.price : 0,
      priceExclVat:
        typeof product.priceExclVat === 'number' ? product.priceExclVat : 0,
      availability: product.availability || 'unknown',
      supplierName: product.brand?.name || 'Electrosales',
      description: product.st_ldesc || '',
      breadcrumbs: Array.isArray(product.breadcrumbs) ? product.breadcrumbs : [],
      imageUrl:
        Array.isArray(product.images) && product.images.length > 0
          ? product.images[0]
          : null,
    };
  }
}
