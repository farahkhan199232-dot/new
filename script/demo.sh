#!/usr/bin/env bash
# Deploy the Fe SplitChai contract with a Fe mock USDC on Base Sepolia and run
# one settle and one settleBatch. Testnet only.
#
#   fe build
#   PRIVATE_KEY=0x... ./script/demo.sh          # or: KEYSTORE=path PASSWORD_FILE=path
set -euo pipefail
RPC=${RPC:-https://sepolia.base.org}
if [[ -n "${KEYSTORE:-}" ]]; then
  AUTH=(--keystore "$KEYSTORE" --password-file "$PASSWORD_FILE")
else
  AUTH=(--private-key "$PRIVATE_KEY")
fi
K=(--rpc-url "$RPC" "${AUTH[@]}")
ME=$(cast wallet address "${AUTH[@]}")
[[ "$(cast chain-id --rpc-url "$RPC")" == "84532" ]] || { echo "not Base Sepolia"; exit 1; }

TOKEN=$(cast send "${K[@]}" --create "0x$(tr -d '\n' < out/MockUsdc.bin)" --json | jq -r .contractAddress)
ARGS=$(cast abi-encode "f(address,address,uint16,address)" "$TOKEN" "$ME" 30 "$ME")
S=$(cast send "${K[@]}" --create "0x$(tr -d '\n' < out/SplitChaiSettlement.bin)${ARGS#0x}" --json | jq -r .contractAddress)
echo "MockUsdc: $TOKEN"
echo "SplitChaiSettlement (Fe): $S"

G=$(cast keccak "goa-trip"); M=$(cast keccak "settlement-1")
BOB=0x000000000000000000000000000000000000b0b0
CAROL=0x00000000000000000000000000000000000ca401
cast send "${K[@]}" "$TOKEN" "mint(address,uint256)" "$ME" 1000000000 >/dev/null
cast send "${K[@]}" "$TOKEN" "approve(address,uint256)" "$S" "$(cast max-uint)" >/dev/null
echo "settle:      $(cast send "${K[@]}" "$S" "settle(bytes32,address,uint256,bytes32)" "$G" $BOB 100000000 "$M" --json | jq -r .transactionHash)"
echo "settleBatch: $(cast send "${K[@]}" "$S" "settleBatch(bytes32,(address,uint256)[],bytes32)" "$G" "[($BOB,40000000),($CAROL,60000000)]" "$M" --json | jq -r .transactionHash)"
echo "bob:   $(cast call --rpc-url "$RPC" "$TOKEN" "balanceOf(address)(uint256)" $BOB)"
echo "carol: $(cast call --rpc-url "$RPC" "$TOKEN" "balanceOf(address)(uint256)" $CAROL)"
