pub mod agent;
pub mod executor;
pub mod safety;

pub use agent::*;
pub use executor::*;
pub use safety::*;

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentConfig {
    pub name: String,
    pub model: String,
    pub persona: Option<String>,
    pub tools: Vec<String>,
    pub memory_store: Option<String>,
    pub max_tokens: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphTopology {
    pub entry: String,
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphNode {
    pub name: String,
    pub agent: String,
    pub task: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphEdge {
    pub from: String,
    pub to: String,
    pub condition: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionContext {
    pub variables: HashMap<String, String>,
    pub node_results: HashMap<String, NodeResult>,
    pub current_node: Option<String>,
    pub iteration: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeResult {
    pub node: String,
    pub status: ExecutionStatus,
    pub output: Option<String>,
    pub error: Option<String>,
    pub tokens_used: usize,
    pub duration_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ExecutionStatus {
    Success,
    Failure,
    Skipped,
    Timeout,
}

#[derive(Debug, Clone)]
pub struct ExecutionConfig {
    pub max_iterations: usize,
    pub timeout_per_node: Duration,
    pub confirm_before_write: bool,
    pub project_root: Option<std::path::PathBuf>,
}

impl Default for ExecutionConfig {
    fn default() -> Self {
        ExecutionConfig {
            max_iterations: 10,
            timeout_per_node: Duration::from_secs(60),
            confirm_before_write: true,
            project_root: None,
        }
    }
}

impl AgentConfig {
    pub fn from_emd_section(section: &emd::Section) -> Option<Self> {
        if section.section_type != emd::SectionType::Agent {
            return None;
        }

        let mut config = AgentConfig {
            name: section.title.clone(),
            model: "gpt-4o".to_string(),
            persona: None,
            tools: Vec::new(),
            memory_store: None,
            max_tokens: None,
        };

        for element in &section.content {
            if let emd::SectionElement::Link(link) = element {
                match link.relation {
                    emd::LinkRelation::Model => {
                        config.model = link.target.clone();
                    }
                    emd::LinkRelation::Persona => {
                        config.persona = Some(link.target.clone());
                    }
                    emd::LinkRelation::Tools => {
                        config.tools = link.target.split(',').map(|t| t.trim().to_string()).collect();
                    }
                    emd::LinkRelation::Memory | emd::LinkRelation::StoreIn => {
                        config.memory_store = Some(link.target.clone());
                    }
                    emd::LinkRelation::MaxIterations => {
                        config.max_tokens = link.target.trim().parse().ok();
                    }
                    _ => {}
                }
            }
        }

        Some(config)
    }
}

impl GraphTopology {
    pub fn from_emd_section(section: &emd::Section) -> Option<Self> {
        if section.section_type != emd::SectionType::Graph {
            return None;
        }

        let mut topology = GraphTopology {
            entry: String::new(),
            nodes: Vec::new(),
            edges: Vec::new(),
        };

        for element in &section.content {
            if let emd::SectionElement::Link(link) = element {
                match link.relation {
                    emd::LinkRelation::Entry => {
                        topology.entry = link.target.clone();
                    }
                    emd::LinkRelation::Node => {
                        let parts: Vec<&str> = link.target.splitn(2, ':').collect();
                        let node = GraphNode {
                            name: parts[0].trim().to_string(),
                            agent: parts.get(1).map(|s| s.trim().to_string()).unwrap_or_default(),
                            task: parts.get(1).map(|s| s.trim().to_string()).unwrap_or_default(),
                        };
                        topology.nodes.push(node);
                    }
                    emd::LinkRelation::Edge => {
                        if let Some((from, to)) = link.target.split_once("->") {
                            let from_clean = from.trim();
                            let (to_clean, condition) = if let Some((t, c)) = to.trim()
                                .split_once("[condition:")
                            {
                                (t.trim(), Some(c.trim().trim_end_matches(']').trim().to_string()))
                            } else {
                                (to.trim(), None)
                            };
                            topology.edges.push(GraphEdge {
                                from: from_clean.to_string(),
                                to: to_clean.to_string(),
                                condition,
                            });
                        }
                    }
                    _ => {}
                }
            }
        }

        if topology.entry.is_empty() && !topology.nodes.is_empty() {
            topology.entry = topology.nodes[0].name.clone();
        }

        Some(topology)
    }
}
