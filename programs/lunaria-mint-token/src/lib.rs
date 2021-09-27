pub mod utils;

use {
    crate::utils::{assert_initialized, spl_token_transfer, TokenTransferParams},
    anchor_lang::{prelude::*, solana_program::system_program, AnchorDeserialize, AnchorSerialize},
    spl_associated_token_account::{get_associated_token_address},
    spl_token::state::Account,
};

declare_id!("Gkazfbm381uaVcbuDhECF6iK2QXMQEMxJvXZjZsJMW3v");

const PREFIX: &str = "ticket_account";
#[program]
pub mod lunaria_mint_token {
    use super::*;

    pub fn airdrop(ctx: Context<Airdrop>, bump: u8) -> ProgramResult {
        let mint_key = ctx.accounts.mint.key();
        let user = &ctx.accounts.user;
        let associated_token_account_key =
            get_associated_token_address(&user.key, &ctx.accounts.mint.key);
        if associated_token_account_key != *ctx.accounts.user_token_account.key {
            return Err(ErrorCode::IncorrectAssociatedTokenAccount.into());
        }
        let associated_token_account: Account =
            assert_initialized(&ctx.accounts.user_token_account)?;
        if associated_token_account.amount >= 1 {
            return Ok(());
            // return Err(ErrorCode::AirdropLimitReached.into());
        }

        let expected_source_token_authority = Pubkey::create_program_address(
            &[&PREFIX.as_bytes(), &mint_key.to_bytes(), &[bump]],
            &id(),
        )?;
        let authority_seeds = [PREFIX.as_bytes(), mint_key.as_ref(), &[bump]];

        if expected_source_token_authority != *ctx.accounts.source_authority.key {
            return Err(ErrorCode::IncorrectProgramTokenAccount.into());
        }

        msg!("Passed all checks, about to transfer...");

        spl_token_transfer(TokenTransferParams {
            source: ctx.accounts.source_token_account.clone(),
            destination: ctx.accounts.user_token_account.clone(),
            authority: ctx.accounts.source_authority.clone(),
            authority_signer_seeds: &authority_seeds,
            token_program: ctx.accounts.token_program.clone(),
            amount: 1,
        })?;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Airdrop<'info> {
    source_authority: AccountInfo<'info>,
    #[account(constraint = *mint.owner == spl_token::id())]
    mint: AccountInfo<'info>,
    #[account(signer)]
    user: AccountInfo<'info>,
    #[account(constraint = *user_token_account.owner == spl_token::id())]
    user_token_account: AccountInfo<'info>,
    #[account(mut, constraint = *source_token_account.owner == spl_token::id())]
    source_token_account: AccountInfo<'info>,
    #[account(address = spl_token::id())]
    token_program: AccountInfo<'info>,
    #[account(address = spl_associated_token_account::id())]
    associated_token_program: AccountInfo<'info>,
    #[account(address = system_program::id())]
    system_program: AccountInfo<'info>,
    rent: Sysvar<'info, Rent>,
    #[account(address = id())]
    program: AccountInfo<'info>,
}

#[account]
#[derive(Default)]
pub struct TicketConfig {
    pub authority: Pubkey,
    pub bump: u8,
}

#[error]
pub enum ErrorCode {
    #[msg("Account does not have correct owner!")]
    IncorrectOwner,
    #[msg("Account is not initialized!")]
    Uninitialized,
    #[msg("Token transfer failed")]
    TokenTransferFailed,
    #[msg("Incorrect associated token account")]
    IncorrectAssociatedTokenAccount,
    #[msg("Incorrect program token account")]
    IncorrectProgramTokenAccount,
    #[msg("Already airdropped 1 token")]
    AirdropLimitReached,
}

// 1. Approve this contract to transfer tokens
// 2. on transfer call, transfer 1 token to user
