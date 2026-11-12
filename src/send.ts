import { spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";
import {
  BaseError,
  ContractFunctionRevertedError,
  decodeErrorResult,
  getAddress,
  type Abi,
  type Address,
  type Hex,
  type PublicClient,
} from "viem";
import { blueAbi, callbackAbi, erc20Abi, midnightAbi } from "./abi.ts";

export type SignerOptions =
  { kind: "trezor"; hdPath?: string } | { kind: "unlocked" };

export type Sender = {
  from: Address;
  rpcUrl: string;
  signer: SignerOptions;
  yes: boolean;
};

const errorAbis: Abi[] = [midnightAbi, callbackAbi, blueAbi, erc20Abi];

function run(
  cmd: string,
  args: string[],
  stdin: "inherit" | "ignore" = "inherit",
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: [stdin, "pipe", "inherit"] });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolve(out)
        : reject(new Error(`${cmd} exited with code ${code}`)),
    );
  });
}

function signerArgs(s: SignerOptions, from: Address): string[] {
  if (s.kind === "unlocked") return ["--unlocked", "--from", from];
  return [
    "--trezor",
    ...(s.hdPath ? ["--mnemonic-derivation-path", s.hdPath] : []),
  ];
}

// Refuses to continue unless the Trezor account at the chosen path is the expected address.
export async function checkSigner(sender: Sender): Promise<void> {
  if (sender.signer.kind !== "trezor") return;
  console.log(
    "Reading address from Trezor (confirm on the device if asked)...",
  );
  const out = await run("cast", [
    "wallet",
    "address",
    ...signerArgs(sender.signer, sender.from),
  ]);
  const addr = getAddress(out.trim());
  if (addr !== sender.from)
    throw new Error(
      `Trezor address ${addr} does not match --from ${sender.from}. Check --hd-path.`,
    );
  console.log(`Trezor address OK: ${addr}`);
}

export async function confirm(sender: Sender, question: string): Promise<void> {
  if (sender.yes) return;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(`${question} [y/N] `);
  rl.close();
  if (answer.trim().toLowerCase() !== "y") throw new Error("Aborted by user.");
}

export function describeRevert(err: unknown): string {
  if (err instanceof BaseError) {
    const revert = err.walk((e) => e instanceof ContractFunctionRevertedError);
    if (
      revert instanceof ContractFunctionRevertedError &&
      (revert.reason || revert.data?.errorName)
    ) {
      return revert.reason ?? revert.data!.errorName;
    }
    const raw = err.walk(
      (e) => typeof (e as { data?: unknown }).data === "string",
    ) as { data?: Hex } | null;
    if (raw?.data) {
      for (const abi of errorAbis) {
        try {
          const { errorName, args } = decodeErrorResult({
            abi,
            data: raw.data,
          });
          return errorName === "Error" && typeof args?.[0] === "string"
            ? args[0]
            : errorName;
        } catch {
          continue;
        }
      }
    }
    // e.g. anvil's "EVM error NotActivated" behind viem's generic "An internal error was received."
    return err.details && err.details !== err.shortMessage
      ? `${err.shortMessage} (${err.details})`
      : err.shortMessage;
  }
  return String(err);
}

// Block of the last transaction this process sent. Load-balanced RPCs can answer the next call from a node that
// has not seen that block yet (e.g. a repay simulated without the approval that was just mined), so simulations
// are pinned to at least this block and retried briefly.
let lastSentBlock = 0n;

async function simulate(
  client: PublicClient,
  from: Address,
  to: Address,
  data: Hex,
): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      const latest = await client.getBlockNumber();
      await client.call({
        account: from,
        to,
        data,
        blockNumber: latest > lastSentBlock ? latest : lastSentBlock,
      });
      return;
    } catch (err) {
      if (lastSentBlock === 0n || attempt === 4) throw err;
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

// Simulates the call from the user's address, then (after confirmation) signs and sends it with `cast send`.
export async function send(
  client: PublicClient,
  sender: Sender,
  label: string,
  to: Address,
  data: Hex,
): Promise<void> {
  console.log(`\n--- ${label}`);
  console.log(`to:   ${to}`);
  console.log(`data: ${data}`);
  try {
    await simulate(client, sender.from, to, data);
  } catch (err) {
    throw new Error(`Simulation of "${label}" failed: ${describeRevert(err)}`, {
      cause: err,
    });
  }
  console.log("simulation: OK");
  await confirm(sender, `Send "${label}"?`);
  if (sender.signer.kind === "trezor")
    console.log(
      "Confirm the transaction on the Trezor. Check that 'to' matches the address above.",
    );
  const out = await run("cast", [
    "send",
    "--json",
    "--rpc-url",
    sender.rpcUrl,
    ...signerArgs(sender.signer, sender.from),
    to,
    data,
  ]);
  const receipt = JSON.parse(out) as {
    status: string;
    transactionHash: Hex;
    blockNumber: string | number;
  };
  if (receipt.status !== "0x1" && receipt.status !== "1")
    throw new Error(`Transaction ${receipt.transactionHash} reverted`);
  lastSentBlock = BigInt(receipt.blockNumber);
  console.log(`sent: ${receipt.transactionHash}`);
}
