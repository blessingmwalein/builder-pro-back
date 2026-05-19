import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentType, Priority } from '@prisma/client';

export class TemplateStageDto {
  @ApiProperty()
  @IsString()
  workflowCode: string;

  @ApiProperty()
  @IsInt()
  stageOrder: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  approvalRoles?: string[];
}

export class TemplateTaskDto {
  @ApiProperty()
  @IsString()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'workflowCode of the stage this task belongs to' })
  @IsOptional()
  @IsString()
  stageWorkflowCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  roleCode?: string;

  @ApiPropertyOptional({ enum: Priority, default: Priority.MEDIUM })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  order?: number;
}

export class TemplateDocumentDto {
  @ApiProperty({ enum: DocumentType })
  @IsEnum(DocumentType)
  documentType: DocumentType;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'workflowCode of the stage this doc belongs to' })
  @IsOptional()
  @IsString()
  stageWorkflowCode?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;
}

export class TemplateRoleDto {
  @ApiProperty()
  @IsString()
  roleCode: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;
}

export class TemplateBudgetLineDto {
  @ApiProperty()
  @IsString()
  categoryCode: string;

  @ApiPropertyOptional({ description: 'Percentage of total budget (0-100)' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  suggestedPct?: number;
}

export class TemplateApprovalRuleDto {
  @ApiProperty({ description: 'STAGE | DOCUMENT | BUDGET | PROCUREMENT' })
  @IsString()
  entityType: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  approverRoles: string[];

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  minApprovers?: number;
}

export class CreateTemplateDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'e.g. HOUSE, RENOVATION, COMMERCIAL' })
  @IsOptional()
  @IsString()
  constructionType?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ type: [TemplateStageDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateStageDto)
  stages?: TemplateStageDto[];

  @ApiPropertyOptional({ type: [TemplateTaskDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateTaskDto)
  tasks?: TemplateTaskDto[];

  @ApiPropertyOptional({ type: [TemplateDocumentDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateDocumentDto)
  documents?: TemplateDocumentDto[];

  @ApiPropertyOptional({ type: [TemplateRoleDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateRoleDto)
  roles?: TemplateRoleDto[];

  @ApiPropertyOptional({ type: [TemplateBudgetLineDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateBudgetLineDto)
  budgetLines?: TemplateBudgetLineDto[];

  @ApiPropertyOptional({ type: [TemplateApprovalRuleDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateApprovalRuleDto)
  approvalRules?: TemplateApprovalRuleDto[];
}
