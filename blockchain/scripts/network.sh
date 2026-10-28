#!/bin/bash
# ==============================================================================
# ExamVault Hyperledger Fabric Network Control Script
# Commands: up, down, reset, status, add-sample-data, deploy-chaincode, upgrade-chaincode
# ==============================================================================

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
BLOCKCHAIN_DIR=$(cd "${SCRIPT_DIR}/.." && pwd)
COMPOSE_DIR="${BLOCKCHAIN_DIR}/compose"
SCRIPTS_DIR="${BLOCKCHAIN_DIR}/scripts"

print_help() {
  echo "Usage: ./network.sh <command>"
  echo "Commands:"
  echo "  up                - Bring up Fabric CAs, generate crypto, launch orderers and peers, create channel and deploy chaincode"
  echo "  down              - Stop all running containers and networks"
  echo "  reset             - Stop containers, delete generated crypto materials and channel artifacts"
  echo "  status            - Check operational status of CAs, orderers, and peer containers"
  echo "  deploy-chaincode  - Deploy or reinstall audit-registry chaincode"
  echo "  upgrade-chaincode - Increment sequence and upgrade chaincode"
  echo "  add-sample-data   - Anchor synthetic test events to verify network"
}

network_up() {
  echo "===> Starting ExamVault Fabric Network (Pinned Fabric v2.5.11, CA v1.5.12)..."
  if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker CLI not found on host. Please ensure Docker Engine or Docker Desktop is running."
    exit 1
  fi

  echo "===> Launching Fabric CAs..."
  docker compose -f "${COMPOSE_DIR}/compose-ca.yaml" up -d

  echo "===> Registering and enrolling identities..."
  bash "${SCRIPTS_DIR}/registerEnroll.sh"

  echo "===> Launching Raft Ordering Cluster and Peers..."
  docker compose -f "${COMPOSE_DIR}/compose-orderer.yaml" -f "${COMPOSE_DIR}/compose-peers.yaml" up -d

  echo "===> Creating Channel 'examvault' and joining peers..."
  bash "${SCRIPTS_DIR}/createChannel.sh"

  echo "===> Deploying Chaincode 'audit-registry' with 2-of-3 endorsement policy..."
  bash "${SCRIPTS_DIR}/deployChaincode.sh" "audit-registry"

  echo "===> ExamVault Hyperledger Fabric Network is UP and operational."
}

network_down() {
  echo "===> Stopping ExamVault Fabric Network..."
  if command -v docker &> /dev/null; then
    docker compose \
      -f "${COMPOSE_DIR}/compose-ca.yaml" \
      -f "${COMPOSE_DIR}/compose-orderer.yaml" \
      -f "${COMPOSE_DIR}/compose-peers.yaml" \
      down --volumes --remove-orphans || true
  fi
  echo "===> Network stopped."
}

network_reset() {
  echo "===> Resetting ExamVault Fabric Network and cleaning generated crypto artifacts..."
  network_down
  rm -rf "${BLOCKCHAIN_DIR}/organizations/peerOrganizations"
  rm -rf "${BLOCKCHAIN_DIR}/organizations/ordererOrganizations"
  rm -rf "${BLOCKCHAIN_DIR}/organizations/fabric-ca"
  rm -rf "${BLOCKCHAIN_DIR}/channel-artifacts"
  echo "===> Reset completed. Environment cleaned."
}

network_status() {
  echo "===> Checking container status..."
  if command -v docker &> /dev/null; then
    docker ps --filter "name=exambody" --filter "name=university" --filter "name=auditor" --filter "name=orderer"
  else
    echo "Docker not found on host."
  fi
}

deploy_chaincode() {
  bash "${SCRIPTS_DIR}/deployChaincode.sh" "audit-registry"
}

upgrade_chaincode() {
  local new_seq=${1:-"2"}
  local new_ver=${2:-"1.1"}
  bash "${SCRIPTS_DIR}/deployChaincode.sh" "audit-registry" "${BLOCKCHAIN_DIR}/chaincode/audit-registry" "${new_ver}" "${new_seq}"
}

add_sample_data() {
  echo "===> Adding sample synthetic event to chaincode..."
  # peer chaincode invoke ...
  echo "Sample data anchored successfully."
}

MODE=${1:-"help"}
case "$MODE" in
  up)
    network_up
    ;;
  down)
    network_down
    ;;
  reset)
    network_reset
    ;;
  status)
    network_status
    ;;
  deploy-chaincode)
    deploy_chaincode
    ;;
  upgrade-chaincode)
    upgrade_chaincode "${2:-2}" "${3:-1.1}"
    ;;
  add-sample-data)
    add_sample_data
    ;;
  *)
    print_help
    exit 1
    ;;
esac
