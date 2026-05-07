mod commands;

use clap::{Parser, Subcommand};
use std::path::PathBuf;

#[derive(Parser)]
#[command(name = "emd", version, about = "Everything MarkDown — typed semantic Markdown toolchain")]
pub struct Cli {
    #[command(subcommand)]
    pub command: Commands,

    #[arg(long, global = true, help = "Disable colored output")]
    pub no_color: bool,
}

#[derive(Subcommand)]
pub enum Commands {
    /// Validate EMD files in a project
    Check {
        /// Project root directory
        path: PathBuf,

        /// Promote warnings to errors
        #[arg(long)]
        strict: bool,

        /// Output format
        #[arg(long, value_enum, default_value = "minimal")]
        format: CheckFormat,

        /// Exit code only, no output
        #[arg(long)]
        quiet: bool,
    },

    /// Auto-format EMD files
    Fmt {
        /// File or directory to format
        path: PathBuf,

        /// Check only, exit non-zero if formatting needed
        #[arg(long)]
        check: bool,
    },

    /// Query EMD documents by type and status
    Query {
        /// Query string: "type|status" or "type"
        query: String,

        /// Project root directory (defaults to current dir)
        #[arg(long, default_value = ".")]
        path: PathBuf,

        /// Output format
        #[arg(long, value_enum, default_value = "json")]
        format: QueryFormat,

        /// Show count only
        #[arg(long)]
        count: bool,
    },

    /// Export link graph from project
    Graph {
        /// Project root directory
        path: PathBuf,

        /// Output format
        #[arg(long, value_enum, default_value = "dot")]
        format: GraphFormat,
    },

    /// Export EMD file to other formats
    Export {
        /// File or directory to export
        path: PathBuf,

        /// Output format
        #[arg(long, value_enum)]
        format: ExportFormat,

        /// Output directory
        #[arg(long)]
        output: Option<PathBuf>,
    },

    /// Scaffold a new EMD project
    New {
        /// Project name or path
        name: String,

        /// Template name
        #[arg(long)]
        template: Option<String>,

        /// List available templates
        #[arg(long)]
        list: bool,
    },

    /// Start LSP server on stdio
    Lsp,
}

#[derive(clap::ValueEnum, Clone)]
pub enum CheckFormat {
    Minimal,
    Json,
}

#[derive(clap::ValueEnum, Clone)]
pub enum QueryFormat {
    Json,
    Table,
}

#[derive(clap::ValueEnum, Clone)]
pub enum GraphFormat {
    Dot,
    Json,
}

#[derive(clap::ValueEnum, Clone)]
pub enum ExportFormat {
    Html,
    Json,
    Md,
    Dot,
    Static,
}

fn main() {
    let cli = Cli::parse();

    if cli.no_color || std::env::var("NO_COLOR").is_ok() {
        // Color is controlled by miette's fancy feature
    }

    let result = match cli.command {
        Commands::Check { path, strict, format, quiet } => {
            commands::check::run(path, strict, format, quiet)
        }
        Commands::Fmt { path, check } => {
            commands::fmt::run(path, check)
        }
        Commands::Query { query, path, format, count } => {
            commands::query::run(query, path, format, count)
        }
        Commands::Graph { path, format } => {
            commands::graph::run(path, format)
        }
        Commands::Export { path, format, output } => {
            commands::export::run(path, format, output)
        }
        Commands::New { name, template, list } => {
            commands::new_cmd::run(name, template, list)
        }
        Commands::Lsp => {
            commands::lsp::run()
        }
    };

    if let Err(e) = result {
        eprintln!("{}", e);
        std::process::exit(1);
    }
}
