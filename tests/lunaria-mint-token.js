const anchor = require("@project-serum/anchor");
const splToken = require("@solana/spl-token");
const fs = require("fs");
const { assert } = require('chai');

const { SystemProgram } = anchor.web3;
const { Token } = splToken;

describe("lunaria-mint-token", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.Provider.env());

  it("it works!", async () => {
    const userSecretKey = Uint8Array.from(
      JSON.parse(
        fs.readFileSync("/Users/michaelyu/.config/solana/ticket-test.json")
      )
    );
    const authoritySecretKey = Uint8Array.from(
      JSON.parse(fs.readFileSync("/Users/michaelyu/.config/solana/id.json"))
    );
    const keypair = anchor.web3.Keypair.fromSecretKey(userSecretKey);
    const authority = anchor.web3.Keypair.fromSecretKey(authoritySecretKey);
    const provider = anchor.getProvider();

    await anchor.web3.sendAndConfirmTransaction(
      provider.connection,
      new anchor.web3.Transaction().add(
        anchor.web3.SystemProgram.transfer({
          fromPubkey: authority.publicKey,
          toPubkey: keypair.publicKey,
          lamports: anchor.web3.LAMPORTS_PER_SOL,
        })
      ),
      [authority]
    );
    const program = anchor.workspace.LunariaMintToken;

    const token = await Token.createMint(
      provider.connection,
      authority,
      authority.publicKey,
      authority.publicKey,
      0,
      splToken.TOKEN_PROGRAM_ID
    );
    const authorityAccount = await token.createAssociatedTokenAccount(
      authority.publicKey
    );
    await token.mintTo(authorityAccount, authority, [], 10000);

    const [ticketAssociatedAccount, bumpSeed] =
      await anchor.web3.PublicKey.findProgramAddress(
        [
          Buffer.from("ticket_account"),
          token.publicKey.toBytes(),
        ],
        program.programId
      );

    await token.approve(authorityAccount, ticketAssociatedAccount, authority, [], 9000);

    const associatedTokenAccountAddress = await Token.getAssociatedTokenAddress(
      splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
      splToken.TOKEN_PROGRAM_ID,
      token.publicKey,
      keypair.publicKey
    );
    const createInstruction = Token.createAssociatedTokenAccountInstruction(
      splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
      splToken.TOKEN_PROGRAM_ID,
      token.publicKey,
      associatedTokenAccountAddress,
      keypair.publicKey,
      keypair.publicKey
    );

    const accounts = {
      mint: token.publicKey,
      sourceTokenAccount: authorityAccount,
      sourceAuthority: ticketAssociatedAccount,
      user: keypair.publicKey,
      userTokenAccount: associatedTokenAccountAddress,
      systemProgram: SystemProgram.programId,
      associatedTokenProgram: splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
      tokenProgram: splToken.TOKEN_PROGRAM_ID,
      rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      program: program.programId,
    };

    const tx = await program.rpc.airdrop(bumpSeed, {
      accounts,
      instructions: [createInstruction],
      signers: [keypair],
    });
    console.log("Your airdrop signature", tx);

    const info = await token.getAccountInfo(associatedTokenAccountAddress);
    assert.ok(info.amount.toNumber() === 1);

    // try airdrop again
    try {
      const associatedTokenAccountAddress2 = await Token.getAssociatedTokenAddress(
        splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
        splToken.TOKEN_PROGRAM_ID,
        token.publicKey,
        keypair.publicKey
      );
      const createInstruction2 = Token.createAssociatedTokenAccountInstruction(
        splToken.ASSOCIATED_TOKEN_PROGRAM_ID,
        splToken.TOKEN_PROGRAM_ID,
        token.publicKey,
        associatedTokenAccountAddress2,
        keypair.publicKey,
        keypair.publicKey
      );
      await program.rpc.airdrop(bumpSeed, {
        accounts: {
          ...accounts,
          userTokenAccount: associatedTokenAccountAddress2
        },
        instructions: [createInstruction2],
        signers: [keypair],
      });
      assert.ok(false);
    } catch (e) {
      assert.ok(true);
    }
  });
});
