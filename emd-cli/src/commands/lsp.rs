pub fn run() -> Result<(), String> {
    let rt = tokio::runtime::Runtime::new().map_err(|e| format!("Failed to create runtime: {}", e))?;
    rt.block_on(async {
        emd::lsp_server::start_lsp_server().await;
    });
    Ok(())
}
