export { initSync, get_version } from './emd.js';

export interface EmdDocument {
    sections: EmdSection[];
    diagnostics: EmdDiagnostic[];
    metadata: DocumentMetadata;
}

export interface EmdSection {
    level: number;
    section_type: string;
    status: string | null;
    title: string;
    content: any[];
    subsections: EmdSection[];
    source_span: { start: number; end: number };
    diagnostics: EmdDiagnostic[];
    metadata: SectionMetadata;
}

export interface EmdDiagnostic {
    severity: string;
    message: string;
    code: string;
    span: { start: number; end: number } | null;
}

export interface DocumentMetadata {
    title: string | null;
    version: string | null;
    owner: string | null;
}

export interface SectionMetadata {
    status_override: string | null;
    depends_on: string[];
    id: string | null;
}

export interface ParseOptions {
    json?: boolean;
    moduleOrPath?: string | URL;
}

export interface ValidateOptions {
    moduleOrPath?: string | URL;
}

export function parse(source: string, options?: ParseOptions): Promise<EmdDocument>;

export function serialize(doc: EmdDocument | string, options?: ParseOptions): Promise<string>;

export function validate(
    doc: EmdDocument | string,
    files?: Record<string, string> | string,
    options?: ValidateOptions
): Promise<EmdDiagnostic[]>;

export function validateDirect(
    doc: any,
    files: any,
    options?: ValidateOptions
): Promise<EmdDiagnostic[]>;
