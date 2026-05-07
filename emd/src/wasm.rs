use wasm_bindgen::prelude::*;
use crate::{parse, serialize, validate, EmdIndex, EmdDocument};
use serde_wasm_bindgen;

#[wasm_bindgen(start)]
pub fn init_panic_hook() {
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub fn parse_emd(source: &str) -> JsValue {
    let doc = parse(source);
    serde_wasm_bindgen::to_value(&doc).unwrap_or(JsValue::NULL)
}

#[wasm_bindgen]
pub fn parse_emd_json(source: &str) -> String {
    let doc = parse(source);
    serde_json::to_string_pretty(&doc).unwrap_or_else(|e| format!("{{\"error\": \"{}\"}}", e))
}

#[wasm_bindgen]
pub fn validate_emd(doc_json: &str, files_json: &str) -> String {
    let doc: EmdDocument = match serde_json::from_str(doc_json) {
        Ok(d) => d,
        Err(e) => return format!("{{\"error\": \"Failed to parse doc: {}\"}}", e),
    };

    let files: Vec<(String, String)> = match serde_json::from_str(files_json) {
        Ok(f) => f,
        Err(e) => return format!("{{\"error\": \"Failed to parse files: {}\"}}", e),
    };

    let index = EmdIndex::build_virtual(files);
    let diagnostics = validate(&doc, &index, false);
    serde_json::to_string_pretty(&diagnostics).unwrap_or_else(|e| format!("{{\"error\": \"{}\"}}", e))
}

#[wasm_bindgen]
pub fn serialize_emd(doc_json: &str) -> String {
    let doc: EmdDocument = match serde_json::from_str(doc_json) {
        Ok(d) => d,
        Err(e) => return format!("{{\"error\": \"{}\"}}", e),
    };
    serialize(&doc)
}

#[wasm_bindgen]
pub fn validate_emd_direct(doc: JsValue, files: JsValue) -> String {
    let doc: EmdDocument = match serde_wasm_bindgen::from_value(doc) {
        Ok(d) => d,
        Err(e) => return format!("{{\"error\": \"Failed to deserialize doc: {}\"}}", e),
    };

    let files_map: Vec<(String, String)> = match serde_wasm_bindgen::from_value(files) {
        Ok(f) => f,
        Err(e) => return format!("{{\"error\": \"Failed to deserialize files: {}\"}}", e),
    };

    let index = EmdIndex::build_virtual(files_map);
    let diagnostics = validate(&doc, &index, false);
    serde_json::to_string_pretty(&diagnostics).unwrap_or_else(|e| format!("{{\"error\": \"{}\"}}", e))
}

#[wasm_bindgen]
pub fn get_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}
