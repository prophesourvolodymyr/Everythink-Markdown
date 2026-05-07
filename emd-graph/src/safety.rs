use std::time::Duration;

#[derive(Debug, Clone)]
pub struct SafetyConfig {
    pub max_iterations: usize,
    pub timeout: Duration,
    pub confirm_writes: bool,
    pub allowed_paths: Vec<std::path::PathBuf>,
    pub max_tokens_per_agent: usize,
    pub cumulative_token_limit: usize,
}

impl Default for SafetyConfig {
    fn default() -> Self {
        SafetyConfig {
            max_iterations: 10,
            timeout: Duration::from_secs(300),
            confirm_writes: true,
            allowed_paths: Vec::new(),
            max_tokens_per_agent: 100_000,
            cumulative_token_limit: 1_000_000,
        }
    }
}

#[derive(Debug)]
pub struct SafetyGuard {
    config: SafetyConfig,
    iteration_count: usize,
    token_count: usize,
}

impl SafetyGuard {
    pub fn new(config: SafetyConfig) -> Self {
        SafetyGuard {
            config,
            iteration_count: 0,
            token_count: 0,
        }
    }

    pub fn check_iteration(&mut self) -> Result<(), SafetyError> {
        self.iteration_count += 1;
        if self.iteration_count > self.config.max_iterations {
            return Err(SafetyError::MaxIterationsExceeded {
                limit: self.config.max_iterations,
            });
        }
        Ok(())
    }

    pub fn check_token_usage(&mut self, tokens: usize) -> Result<(), SafetyError> {
        self.token_count += tokens;
        if tokens > self.config.max_tokens_per_agent {
            return Err(SafetyError::AgentTokenLimitExceeded {
                limit: self.config.max_tokens_per_agent,
                used: tokens,
            });
        }
        if self.token_count > self.config.cumulative_token_limit {
            return Err(SafetyError::CumulativeTokenLimitExceeded {
                limit: self.config.cumulative_token_limit,
                total: self.token_count,
            });
        }
        Ok(())
    }

    pub fn validate_file_access(&self, path: &std::path::Path) -> Result<(), SafetyError> {
        if self.config.allowed_paths.is_empty() {
            return Ok(());
        }

        let canonical = path
            .canonicalize()
            .unwrap_or_else(|_| path.to_path_buf());

        for allowed in &self.config.allowed_paths {
            if canonical.starts_with(allowed) {
                return Ok(());
            }
        }

        Err(SafetyError::PathNotAllowed {
            path: path.display().to_string(),
        })
    }

    pub fn should_confirm(&self) -> bool {
        self.config.confirm_writes
    }

    pub fn reset_iteration_count(&mut self) {
        self.iteration_count = 0;
    }
}

#[derive(Debug, Clone, thiserror::Error)]
pub enum SafetyError {
    #[error("Maximum iterations ({limit}) exceeded")]
    MaxIterationsExceeded { limit: usize },

    #[error("Agent token limit exceeded: used {used}, limit {limit}")]
    AgentTokenLimitExceeded { limit: usize, used: usize },

    #[error("Cumulative token limit ({limit}) exceeded: {total}")]
    CumulativeTokenLimitExceeded { limit: usize, total: usize },

    #[error("File access not allowed: {path}")]
    PathNotAllowed { path: String },

    #[error("Execution timed out after {0:?}")]
    Timeout(Duration),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_max_iterations_enforced() {
        let config = SafetyConfig {
            max_iterations: 3,
            ..Default::default()
        };
        let mut guard = SafetyGuard::new(config);

        assert!(guard.check_iteration().is_ok());
        assert!(guard.check_iteration().is_ok());
        assert!(guard.check_iteration().is_ok());
        assert!(guard.check_iteration().is_err());
    }

    #[test]
    fn test_token_limit_enforced() {
        let config = SafetyConfig {
            max_tokens_per_agent: 100,
            cumulative_token_limit: 500,
            ..Default::default()
        };
        let mut guard = SafetyGuard::new(config);

        assert!(guard.check_token_usage(50).is_ok());
        assert!(guard.check_token_usage(60).is_ok());
        assert!(guard.check_token_usage(150).is_err()); // exceeds agent limit
    }

    #[test]
    fn test_path_validation() {
        let config = SafetyConfig {
            allowed_paths: vec![std::path::PathBuf::from("/tmp")],
            ..Default::default()
        };
        let guard = SafetyGuard::new(config);

        assert!(guard.validate_file_access(std::path::Path::new("/tmp/test.txt")).is_ok());
        assert!(guard.validate_file_access(std::path::Path::new("/etc/passwd")).is_err());
    }
}
