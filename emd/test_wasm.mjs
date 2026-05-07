import { initSync, parse_emd, parse_emd_json, get_version } from './pkg/emd.js';
import { readFileSync } from 'node:fs';

const wasmBuffer = readFileSync('./pkg/emd_bg.wasm');
initSync({ module: wasmBuffer });

console.log('EMD version:', get_version());

const source = '## [task|done] Hello';

const result = parse_emd(source);
console.log('parse_emd("## [task|done] Hello") =>');
console.log(JSON.stringify(result, null, 2));

if (result && result.sections && result.sections.length > 0) {
    const section = result.sections[0];
    console.log('\n--- Verification ---');
    console.log('  section_type:', section.section_type);
    console.log('  status:', section.status);
    console.log('  title:', section.title);
    
    const passed = section.section_type === 'task' && 
        (section.status === 'Done' || section.status === 'done') &&
        section.title === 'Hello';
    
    if (passed) {
        console.log('\nPASSED: parse("## [task|done] Hello") returns valid AST');
    } else {
        console.log('\nFAILED: Unexpected values');
        console.log('  Expected: section_type=task, status=Done, title=Hello');
        process.exit(1);
    }
} else {
    console.log('\nFAILED: No sections found in AST');
    process.exit(1);
}

const jsonResult = parse_emd_json(source);
const parsed = JSON.parse(jsonResult);
console.log('\nparse_emd_json roundtrip OK:', parsed.sections.length > 0);

// Test validate
import { validate_emd, init_panic_hook } from './pkg/emd.js';
init_panic_hook();
const diags = validate_emd(JSON.stringify(parsed), '[]');
const diagParsed = JSON.parse(diags);
console.log('\nvalidate returns:', diagParsed.length, 'diagnostics');
if (diagParsed.length === 0) {
    console.log('PASSED: Valid document produces zero diagnostics');
}
