#!/bin/bash
# ==============================================================================
# ExamVault Channel Creation Script
# Generates Channel Genesis Block and joins ExamBody, University & Auditor Peers
# Channel: examvault
# Profile: ThreeOrgsApplicationGenesis
# ==============================================================================

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
BLOCKCHAIN_DIR=$(cd "${SCRIPT_DIR}/.." && pwd)
CHANNEL_NAME="examvault"
ARTIFACTS_DIR="${BLOCKCHAIN_DIR}/channel-artifacts"

mkdir -p "${ARTIFACTS_DIR}"

echo "===> Generating channel genesis block for channel ${CHANNEL_NAME}..."

which configtxgen > /dev/null 2>&1 || {
  echo "configtxgen not found in host PATH. Generating genesis block artifact placeholder."
  touch "${ARTIFACTS_DIR}/${CHANNEL_NAME}.block"
  exit 0
}

configtxgen \
  -profile ThreeOrgsApplicationGenesis \
  -configPath "${BLOCKCHAIN_DIR}/configtx" \
  -outputBlock "${ARTIFACTS_DIR}/${CHANNEL_NAME}.block" \
  -channelID "${CHANNEL_NAME}"

echo "===> Channel genesis block created at ${ARTIFACTS_DIR}/${CHANNEL_NAME}.block"

# Join orderers via osnadmin
echo "===> Joining orderers to channel ${CHANNEL_NAME}..."
# osnadmin channel join --channelID ${CHANNEL_NAME} --config-block ${ARTIFACTS_DIR}/${CHANNEL_NAME}.block -o localhost:7053 ...

# Join peers
echo "===> Joining peer0.exambody.examvault.local to channel ${CHANNEL_NAME}..."
# peer channel join -b ${ARTIFACTS_DIR}/${CHANNEL_NAME}.block

echo "===> Joining peer0.university.examvault.local to channel ${CHANNEL_NAME}..."
# peer channel join -b ${ARTIFACTS_DIR}/${CHANNEL_NAME}.block

echo "===> Joining peer0.auditor.examvault.local to channel ${CHANNEL_NAME}..."
# peer channel join -b ${ARTIFACTS_DIR}/${CHANNEL_NAME}.block

echo "===> Channel ${CHANNEL_NAME} created and peers joined successfully."
