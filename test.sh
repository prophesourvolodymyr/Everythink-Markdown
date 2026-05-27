#!/bin/bash
set -e

echo "════════════════════════════════════════════════════════"
echo "  EMD Full Test Suite"
echo "════════════════════════════════════════════════════════"
echo ""

# ── 1. Rust Parser Tests ──
echo "━━━ 1. Rust Parser Tests ━━━"
cd emd
cargo test 2>&1 | grep -E "test result|FAILED|PASSED"
cd ..
echo ""

# ── 2. Rust CLI Tests ──
echo "━━━ 2. Rust CLI Tests ━━━"
cd emd-cli
cargo test 2>&1 | grep -E "test result|FAILED"
cd ..
echo ""

# ── 3. CLI: Check test project ──
echo "━━━ 3. CLI: emd check ━━━"
cd emd-cli
cargo run -- check ../test-project 2>&1 | tail -3
cd ..
echo ""

# ── 4. CLI: Format test file ──
echo "━━━ 4. CLI: emd fmt ━━━"
cd emd-cli
cargo run -- fmt ../test-project/test.emd 2>&1 | tail -3
cd ..
echo ""

# ── 5. CLI: Build release binary ──
echo "━━━ 5. CLI: Release build ━━━"
cd emd-cli
cargo build --release 2>&1 | tail -2
cd ..
echo ""

# ── 6. WASM: Build wasm-pack ──
echo "━━━ 6. WASM: wasm-pack build ━━━"
cd emd
wasm-pack build --target web 2>&1 | tail -5 || echo "(wasm-pack not installed — skipping)"
cd ..
echo ""

# ── 7. Interpreter: TypeScript tests ──
echo "━━━ 7. Interpreter: npm test ━━━"
cd interpreter
npm test 2>&1 | tail -10
cd ..
echo ""

# ── 8. Interpreter: TypeScript typecheck ──
echo "━━━ 8. Interpreter: tsc --noEmit ━━━"
cd interpreter
npx tsc --noEmit 2>&1 && echo "TypeScript: clean" || echo "TypeScript: errors found"
cd ..
echo ""

# ── 9. Interpreter: Build ──
echo "━━━ 9. Interpreter: npm run build ━━━"
cd interpreter
npm run build 2>&1 | tail -5
cd ..
echo ""

echo "════════════════════════════════════════════════════════"
echo "  Test suite complete."
echo "  Check output above for any FAILED or error lines."
echo "════════════════════════════════════════════════════════"
