import init, { parse_emd, parse_emd_json, serialize_emd, validate_emd, validate_emd_direct, get_version, initSync } from './emd.js';
import { init_panic_hook } from './emd.js';

let initialized = false;

async function ensureInit(moduleOrPath) {
    if (!initialized) {
        await init(typeof moduleOrPath === 'string' ? moduleOrPath : undefined);
        init_panic_hook();
        initialized = true;
    }
}

export { initSync, get_version };

export async function parse(source, options = {}) {
    await ensureInit(options.moduleOrPath);
    if (options.json !== false) {
        const doc = parse_emd(source);
        return doc;
    }
    return JSON.parse(parse_emd_json(source));
}

export async function serialize(doc, options = {}) {
    await ensureInit(options.moduleOrPath);
    if (typeof doc === 'string') {
        return serialize_emd(doc);
    }
    return serialize_emd(JSON.stringify(doc));
}

export async function validate(doc, files = {}, options = {}) {
    await ensureInit(options.moduleOrPath);
    const results = validate_emd(
        typeof doc === 'string' ? doc : JSON.stringify(doc),
        typeof files === 'string' ? files : JSON.stringify(files)
    );
    return JSON.parse(results);
}

export async function validateDirect(doc, files, options = {}) {
    await ensureInit(options.moduleOrPath);
    const results = validate_emd_direct(doc, files);
    return JSON.parse(results);
}
