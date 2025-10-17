use anchor_lang::prelude::*;

declare_id!("FZ1TLUm7HMd87DeKgTxRAUdCKPLsoVGt3zy4u57TBLbx");

#[program]
pub mod civicchain {
    use super::*;

    /// Initialize a new user account
    /// user_pubkey: The public key of the user's wallet (from Privy)
    /// payer: The master wallet that pays for account creation
    pub fn initialize_user(
        ctx: Context<InitializeUser>,
        user_pubkey: Pubkey,
        initial_rep: u32,
        role: UserRole,
    ) -> Result<()> {
        let user_account = &mut ctx.accounts.user_account;
        user_account.wallet_address = user_pubkey;
        user_account.reputation = initial_rep;
        user_account.role = role;
        user_account.total_issues = 0;
        user_account.total_verifications = 0;
        user_account.created_at = Clock::get()?.unix_timestamp;
        user_account.bump = ctx.bumps.user_account;
        
        msg!("User initialized: {}", user_pubkey);
        Ok(())
    }

    /// Create a new issue
    pub fn create_issue(
        ctx: Context<CreateIssue>,
        issue_hash: [u8; 32],
        category: IssueCategory,
        priority: u8,
    ) -> Result<()> {
        let issue_account = &mut ctx.accounts.issue_account;
        let user_account = &mut ctx.accounts.user_account;
        
        issue_account.issue_hash = issue_hash;
        issue_account.reporter = ctx.accounts.authority.key();
        issue_account.status = IssueStatus::Open;
        issue_account.category = category;
        issue_account.priority = priority;
        issue_account.upvotes = 0;
        issue_account.downvotes = 0;
        issue_account.verifications = 0;
        issue_account.created_at = Clock::get()?.unix_timestamp;
        issue_account.updated_at = Clock::get()?.unix_timestamp;
        issue_account.bump = ctx.bumps.issue_account;
        
        // Update user total issues
        user_account.total_issues = user_account.total_issues.checked_add(1)
            .ok_or(ErrorCode::Overflow)?;
        
        msg!("Issue created with hash: {:?}", issue_hash);
        Ok(())
    }

    /// Record a vote on an issue
    pub fn record_vote(
        ctx: Context<RecordVote>,
        vote_type: VoteType,
    ) -> Result<()> {
        let issue_account = &mut ctx.accounts.issue_account;
        
        match vote_type {
            VoteType::Upvote => {
                issue_account.upvotes = issue_account.upvotes.checked_add(1)
                    .ok_or(ErrorCode::Overflow)?;
            },
            VoteType::Downvote => {
                issue_account.downvotes = issue_account.downvotes.checked_add(1)
                    .ok_or(ErrorCode::Overflow)?;
            }
        }
        
        issue_account.updated_at = Clock::get()?.unix_timestamp;
        
        msg!("Vote recorded: {:?}", vote_type);
        Ok(())
    }

    /// Record a verification
    pub fn record_verification(
        ctx: Context<RecordVerification>,
    ) -> Result<()> {
        let issue_account = &mut ctx.accounts.issue_account;
        let verifier_account = &mut ctx.accounts.verifier_account;
        
        // Issue must be in resolved status
        require!(
            issue_account.status == IssueStatus::Resolved,
            ErrorCode::InvalidStatus
        );
        
        issue_account.verifications = issue_account.verifications.checked_add(1)
            .ok_or(ErrorCode::Overflow)?;
        
        // Auto-close if threshold reached (3 verifications)
        if issue_account.verifications >= 3 {
            issue_account.status = IssueStatus::Closed;
        }
        
        issue_account.updated_at = Clock::get()?.unix_timestamp;
        
        // Update verifier total verifications
        verifier_account.total_verifications = verifier_account.total_verifications.checked_add(1)
            .ok_or(ErrorCode::Overflow)?;
        
        msg!("Verification recorded. Total: {}", issue_account.verifications);
        Ok(())
    }

    /// Update issue status (government only)
    pub fn update_issue_status(
        ctx: Context<UpdateIssueStatus>,
        new_status: IssueStatus,
    ) -> Result<()> {
        let issue_account = &mut ctx.accounts.issue_account;
        let government_account = &ctx.accounts.government_account;
        
        // Verify user is government
        require!(
            government_account.role == UserRole::Government,
            ErrorCode::Unauthorized
        );
        
        issue_account.status = new_status;
        issue_account.updated_at = Clock::get()?.unix_timestamp;
        
        msg!("Issue status updated to: {:?}", new_status);
        Ok(())
    }

    /// Update user reputation
    pub fn update_reputation(
        ctx: Context<UpdateReputation>,
        new_rep: u32,
    ) -> Result<()> {
        let user_account = &mut ctx.accounts.user_account;
        let old_rep = user_account.reputation;
        user_account.reputation = new_rep;
        
        msg!("Reputation updated from {} to {}", old_rep, new_rep);
        Ok(())
    }
}

// ============================================================================
// Account Structures
// ============================================================================

#[account]
pub struct UserAccount {
    pub wallet_address: Pubkey,
    pub reputation: u32,
    pub role: UserRole,
    pub total_issues: u32,
    pub total_verifications: u32,
    pub created_at: i64,
    pub bump: u8,
}

#[account]
pub struct IssueAccount {
    pub issue_hash: [u8; 32],
    pub reporter: Pubkey,
    pub status: IssueStatus,
    pub category: IssueCategory,
    pub priority: u8,
    pub upvotes: u32,
    pub downvotes: u32,
    pub verifications: u32,
    pub created_at: i64,
    pub updated_at: i64,
    pub bump: u8,
}

// ============================================================================
// Context Structures
// ============================================================================

#[derive(Accounts)]
#[instruction(user_pubkey: Pubkey)]
pub struct InitializeUser<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + 32 + 4 + 1 + 4 + 4 + 8 + 1,
        seeds = [b"user", user_pubkey.as_ref()],
        bump
    )]
    pub user_account: Account<'info, UserAccount>,
    
    #[account(mut)]
    pub payer: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(issue_hash: [u8; 32])]
pub struct CreateIssue<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 1 + 1 + 1 + 4 + 4 + 4 + 8 + 8 + 1,
        seeds = [b"issue", issue_hash.as_ref()],
        bump
    )]
    pub issue_account: Account<'info, IssueAccount>,
    
    #[account(
        mut,
        seeds = [b"user", authority.key().as_ref()],
        bump = user_account.bump
    )]
    pub user_account: Account<'info, UserAccount>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RecordVote<'info> {
    #[account(
        mut,
        seeds = [b"issue", issue_account.issue_hash.as_ref()],
        bump = issue_account.bump
    )]
    pub issue_account: Account<'info, IssueAccount>,
    
    #[account(
        seeds = [b"user", reporter_account.wallet_address.as_ref()],
        bump = reporter_account.bump
    )]
    pub reporter_account: Account<'info, UserAccount>,
    
    #[account(
        seeds = [b"user", voter.key().as_ref()],
        bump = voter_account.bump
    )]
    pub voter_account: Account<'info, UserAccount>,
    
    pub voter: Signer<'info>,
}

#[derive(Accounts)]
pub struct RecordVerification<'info> {
    #[account(
        mut,
        seeds = [b"issue", issue_account.issue_hash.as_ref()],
        bump = issue_account.bump
    )]
    pub issue_account: Account<'info, IssueAccount>,
    
    #[account(
        mut,
        seeds = [b"user", verifier.key().as_ref()],
        bump = verifier_account.bump
    )]
    pub verifier_account: Account<'info, UserAccount>,
    
    pub verifier: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdateIssueStatus<'info> {
    #[account(
        mut,
        seeds = [b"issue", issue_account.issue_hash.as_ref()],
        bump = issue_account.bump
    )]
    pub issue_account: Account<'info, IssueAccount>,
    
    #[account(
        seeds = [b"user", government.key().as_ref()],
        bump = government_account.bump
    )]
    pub government_account: Account<'info, UserAccount>,
    
    pub government: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdateReputation<'info> {
    #[account(
        mut,
        seeds = [b"user", user_account.wallet_address.as_ref()],
        bump = user_account.bump
    )]
    pub user_account: Account<'info, UserAccount>,
    
    /// Authority that can update reputation (could be program authority)
    pub authority: Signer<'info>,
}

// ============================================================================
// Enums and Types
// ============================================================================

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum UserRole {
    Citizen,
    Government,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum IssueStatus {
    Open,
    InProgress,
    Resolved,
    Closed,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum IssueCategory {
    Pothole,
    Garbage,
    Streetlight,
    Water,
    Other,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum VoteType {
    Upvote,
    Downvote,
}

// ============================================================================
// Error Codes
// ============================================================================

#[error_code]
pub enum ErrorCode {
    #[msg("Arithmetic overflow occurred")]
    Overflow,
    
    #[msg("Invalid status for this operation")]
    InvalidStatus,
    
    #[msg("Unauthorized: Only government users can perform this action")]
    Unauthorized,
}
