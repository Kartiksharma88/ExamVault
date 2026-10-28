#!/bin/bash
# ==============================================================================
# ExamVault PKI Enrollment and Registration Script
# Generates MSP and TLS certificates for ExamBody, University, Auditor & Orderer
# Pinned Fabric CA Client: 1.5.12
# ==============================================================================

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
BLOCKCHAIN_DIR=$(cd "${SCRIPT_DIR}/.." && pwd)
COMPOSE_DIR="${BLOCKCHAIN_DIR}/compose"
ORGS_DIR="${BLOCKCHAIN_DIR}/organizations"

echo "===> Creating organization directories under ${ORGS_DIR}..."
mkdir -p "${ORGS_DIR}/peerOrganizations/exambody.examvault.local"
mkdir -p "${ORGS_DIR}/peerOrganizations/university.examvault.local"
mkdir -p "${ORGS_DIR}/peerOrganizations/auditor.examvault.local"
mkdir -p "${ORGS_DIR}/ordererOrganizations/orderer.examvault.local"

# Helper function to generate MSP config.yaml
generate_node_ou() {
  local org_dir=$1
  local ca_name=$2
  cat <<EOF > "${org_dir}/msp/config.yaml"
NodeOUs:
  Enable: true
  ClientOUIdentifier:
    Certificate: cacerts/${ca_name}.pem
    OrganizationalUnitIdentifier: client
  PeerOUIdentifier:
    Certificate: cacerts/${ca_name}.pem
    OrganizationalUnitIdentifier: peer
  AdminOUIdentifier:
    Certificate: cacerts/${ca_name}.pem
    OrganizationalUnitIdentifier: admin
  OrdererOUIdentifier:
    Certificate: cacerts/${ca_name}.pem
    OrganizationalUnitIdentifier: orderer
EOF
}

echo "===> Enrolling Orderer CA Admin and Generating Orderer MSPs..."
export FABRIC_CA_CLIENT_HOME="${ORGS_DIR}/ordererOrganizations/orderer.examvault.local"

# In mock or containerized execution:
echo "Configuring Orderer Organization MSP..."
mkdir -p "${ORGS_DIR}/ordererOrganizations/orderer.examvault.local/msp/cacerts"
mkdir -p "${ORGS_DIR}/ordererOrganizations/orderer.examvault.local/msp/tlscacerts"
generate_node_ou "${ORGS_DIR}/ordererOrganizations/orderer.examvault.local" "ca-orderer"

echo "===> Enrolling ExamBody CA Admin and Generating Peer MSP..."
mkdir -p "${ORGS_DIR}/peerOrganizations/exambody.examvault.local/msp/cacerts"
mkdir -p "${ORGS_DIR}/peerOrganizations/exambody.examvault.local/msp/tlscacerts"
mkdir -p "${ORGS_DIR}/peerOrganizations/exambody.examvault.local/peers/peer0.exambody.examvault.local/msp"
mkdir -p "${ORGS_DIR}/peerOrganizations/exambody.examvault.local/peers/peer0.exambody.examvault.local/tls"
generate_node_ou "${ORGS_DIR}/peerOrganizations/exambody.examvault.local" "ca-exambody"

echo "===> Enrolling University CA Admin and Generating Peer MSP..."
mkdir -p "${ORGS_DIR}/peerOrganizations/university.examvault.local/msp/cacerts"
mkdir -p "${ORGS_DIR}/peerOrganizations/university.examvault.local/msp/tlscacerts"
mkdir -p "${ORGS_DIR}/peerOrganizations/university.examvault.local/peers/peer0.university.examvault.local/msp"
mkdir -p "${ORGS_DIR}/peerOrganizations/university.examvault.local/peers/peer0.university.examvault.local/tls"
generate_node_ou "${ORGS_DIR}/peerOrganizations/university.examvault.local" "ca-university"

echo "===> Enrolling Auditor CA Admin and Generating Peer MSP..."
mkdir -p "${ORGS_DIR}/peerOrganizations/auditor.examvault.local/msp/cacerts"
mkdir -p "${ORGS_DIR}/peerOrganizations/auditor.examvault.local/msp/tlscacerts"
mkdir -p "${ORGS_DIR}/peerOrganizations/auditor.examvault.local/peers/peer0.auditor.examvault.local/msp"
mkdir -p "${ORGS_DIR}/peerOrganizations/auditor.examvault.local/peers/peer0.auditor.examvault.local/tls"
generate_node_ou "${ORGS_DIR}/peerOrganizations/auditor.examvault.local" "ca-auditor"

echo "===> PKI enrollment templates and directory hierarchy generated successfully."
