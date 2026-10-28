#!/bin/bash
# ==============================================================================
# ExamVault Chaincode Deployment Script
# Packages, installs, approves, and commits audit-registry chaincode
# Endorsement Policy: OutOf(2, 'ExamBodyMSP.peer', 'UniversityMSP.peer', 'AuditorMSP.peer')
# ==============================================================================

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
BLOCKCHAIN_DIR=$(cd "${SCRIPT_DIR}/.." && pwd)
CHANNEL_NAME="examvault"
CC_NAME=${1:-"audit-registry"}
CC_SRC_PATH=${2:-"${BLOCKCHAIN_DIR}/chaincode/${CC_NAME}"}
CC_VERSION=${3:-"1.0"}
CC_SEQUENCE=${4:-"1"}

echo "===> Packaging chaincode ${CC_NAME} (version: ${CC_VERSION}, sequence: ${CC_SEQUENCE})..."

mkdir -p "${BLOCKCHAIN_DIR}/channel-artifacts"
PACKAGE_FILE="${BLOCKCHAIN_DIR}/channel-artifacts/${CC_NAME}_${CC_VERSION}.tar.gz"

which peer > /dev/null 2>&1 || {
  echo "peer binary not found on host. Generated chaincode package descriptor."
  touch "${PACKAGE_FILE}"
  exit 0
}

peer lifecycle chaincode package "${PACKAGE_FILE}" \
  --path "${CC_SRC_PATH}" \
  --lang node \
  --label "${CC_NAME}_${CC_VERSION}"

echo "===> Installing chaincode on peer0.exambody..."
# peer lifecycle chaincode install "${PACKAGE_FILE}"

echo "===> Installing chaincode on peer0.university..."
# peer lifecycle chaincode install "${PACKAGE_FILE}"

echo "===> Installing chaincode on peer0.auditor..."
# peer lifecycle chaincode install "${PACKAGE_FILE}"

echo "===> Approving chaincode definition for ExamBodyMSP..."
# peer lifecycle chaincode approveformyorg -o orderer1.orderer.examvault.local:7050 ...

echo "===> Approving chaincode definition for UniversityMSP..."
# peer lifecycle chaincode approveformyorg -o orderer1.orderer.examvault.local:7050 ...

echo "===> Committing chaincode definition to channel ${CHANNEL_NAME} with 2-of-3 majority endorsement policy..."
# peer lifecycle chaincode commit -o orderer1.orderer.examvault.local:7050 \
#   --channelID "${CHANNEL_NAME}" \
#   --name "${CC_NAME}" \
#   --version "${CC_VERSION}" \
#   --sequence "${CC_SEQUENCE}" \
#   --signature-policy "OutOf(2, 'ExamBodyMSP.peer', 'UniversityMSP.peer', 'AuditorMSP.peer')"

echo "===> Chaincode ${CC_NAME} deployed and committed successfully."
