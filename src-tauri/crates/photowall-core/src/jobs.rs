//! Job management and cancellation system.
//!
//! This module provides infrastructure for managing long-running tasks
//! with cancellation support.

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, RwLock};

/// Unique identifier for a job.
pub type JobId = u64;

/// Token for checking and signaling job cancellation.
///
/// Clone this token to share cancellation state across threads.
#[derive(Debug, Clone)]
pub struct CancelToken {
    cancelled: Arc<AtomicBool>,
    job_id: JobId,
}

impl CancelToken {
    /// Create a new cancel token for the given job ID.
    pub fn new(job_id: JobId) -> Self {
        Self {
            cancelled: Arc::new(AtomicBool::new(false)),
            job_id,
        }
    }

    /// Check if cancellation has been requested.
    #[inline]
    pub fn is_cancelled(&self) -> bool {
        self.cancelled.load(Ordering::Relaxed)
    }

    /// Request cancellation of this job.
    pub fn cancel(&self) {
        self.cancelled.store(true, Ordering::Relaxed);
    }

    /// Get the job ID associated with this token.
    pub fn job_id(&self) -> JobId {
        self.job_id
    }

    /// Get the shared cancellation flag.
    pub fn flag(&self) -> Arc<AtomicBool> {
        self.cancelled.clone()
    }
}

/// Manager for tracking and cancelling long-running jobs.
#[derive(Debug, Default)]
pub struct JobManager {
    next_id: AtomicU64,
    jobs: RwLock<HashMap<JobId, CancelToken>>,
}

impl JobManager {
    /// Create a new job manager.
    pub fn new() -> Self {
        Self {
            next_id: AtomicU64::new(1),
            jobs: RwLock::new(HashMap::new()),
        }
    }

    /// Start a new job and return its cancel token.
    pub fn start_job(&self) -> CancelToken {
        let job_id = self.next_id.fetch_add(1, Ordering::Relaxed);
        let token = CancelToken::new(job_id);

        if let Ok(mut jobs) = self.jobs.write() {
            jobs.insert(job_id, token.clone());
        }

        token
    }

    /// Cancel a job by its ID.
    ///
    /// Returns true if the job was found and cancelled.
    pub fn cancel_job(&self, job_id: JobId) -> bool {
        if let Ok(jobs) = self.jobs.read() {
            if let Some(token) = jobs.get(&job_id) {
                token.cancel();
                return true;
            }
        }
        false
    }

    /// Cancel all running jobs.
    pub fn cancel_all(&self) {
        if let Ok(jobs) = self.jobs.read() {
            for token in jobs.values() {
                token.cancel();
            }
        }
    }

    /// Remove a completed job from tracking.
    pub fn complete_job(&self, job_id: JobId) {
        if let Ok(mut jobs) = self.jobs.write() {
            jobs.remove(&job_id);
        }
    }

    /// Get the number of active jobs.
    pub fn active_job_count(&self) -> usize {
        self.jobs.read().map(|j| j.len()).unwrap_or(0)
    }

    /// Check if a specific job is still active.
    pub fn is_job_active(&self, job_id: JobId) -> bool {
        self.jobs
            .read()
            .map(|j| j.contains_key(&job_id))
            .unwrap_or(false)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cancel_token() {
        let token = CancelToken::new(1);
        assert!(!token.is_cancelled());
        assert_eq!(token.job_id(), 1);

        token.cancel();
        assert!(token.is_cancelled());
    }

    #[test]
    fn test_cancel_token_clone() {
        let token1 = CancelToken::new(1);
        let token2 = token1.clone();

        assert!(!token1.is_cancelled());
        assert!(!token2.is_cancelled());

        token1.cancel();

        assert!(token1.is_cancelled());
        assert!(token2.is_cancelled());
    }

    #[test]
    fn test_job_manager() {
        let manager = JobManager::new();

        let token1 = manager.start_job();
        let token2 = manager.start_job();

        assert_eq!(manager.active_job_count(), 2);
        assert!(manager.is_job_active(token1.job_id()));
        assert!(manager.is_job_active(token2.job_id()));

        manager.cancel_job(token1.job_id());
        assert!(token1.is_cancelled());
        assert!(!token2.is_cancelled());

        manager.complete_job(token1.job_id());
        assert_eq!(manager.active_job_count(), 1);
        assert!(!manager.is_job_active(token1.job_id()));
    }

    #[test]
    fn test_cancel_all() {
        let manager = JobManager::new();

        let token1 = manager.start_job();
        let token2 = manager.start_job();
        let token3 = manager.start_job();

        manager.cancel_all();

        assert!(token1.is_cancelled());
        assert!(token2.is_cancelled());
        assert!(token3.is_cancelled());
    }
}
