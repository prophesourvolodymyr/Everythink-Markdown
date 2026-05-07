/* tslint:disable */
/* eslint-disable */

export function get_version(): string;

export function init_panic_hook(): void;

export function parse_emd(source: string): any;

export function parse_emd_json(source: string): string;

export function serialize_emd(doc_json: string): string;

export function validate_emd(doc_json: string, files_json: string): string;

export function validate_emd_direct(doc: any, files: any): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly get_version: (a: number) => void;
    readonly init_panic_hook: () => void;
    readonly parse_emd: (a: number, b: number) => number;
    readonly parse_emd_json: (a: number, b: number, c: number) => void;
    readonly serialize_emd: (a: number, b: number, c: number) => void;
    readonly validate_emd: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly validate_emd_direct: (a: number, b: number, c: number) => void;
    readonly __wbindgen_export: (a: number, b: number) => number;
    readonly __wbindgen_export2: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_export3: (a: number) => void;
    readonly __wbindgen_export4: (a: number, b: number, c: number) => void;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
