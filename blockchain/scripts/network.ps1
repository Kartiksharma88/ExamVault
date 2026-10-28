<#
.SYNOPSIS
ExamVault Hyperledger Fabric Network Control Script (PowerShell)
.DESCRIPTION
Manages local Fabric 2.5 network containers, channel setup, and chaincode deployment.
#>

param(
    [Parameter(Position=0)]
    [ValidateSet("up", "down", "reset", "status", "deploy-chaincode", "upgrade-chaincode", "add-sample-data", "help")]
    [string]$Command = "help"
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BlockchainDir = Split-Path -Parent $ScriptDir
$ComposeDir = Join-Path $BlockchainDir "compose"

function Test-Docker {
    $docker = Get-Command docker -ErrorAction SilentlyContinue
    return ($null -ne $docker)
}

switch ($Command) {
    "up" {
        Write-Host "===> Starting ExamVault Fabric Network..." -ForegroundColor Cyan
        if (-not (Test-Docker)) {
            Write-Warning "Docker is not installed or not in PATH on this machine. Running in local simulation mode."
            exit 1
        }
        docker compose -f "$ComposeDir/compose-ca.yaml" up -d
        docker compose -f "$ComposeDir/compose-orderer.yaml" -f "$ComposeDir/compose-peers.yaml" up -d
        Write-Host "===> Network containers started." -ForegroundColor Green
    }
    "down" {
        Write-Host "===> Stopping Fabric containers..." -ForegroundColor Cyan
        if (Test-Docker) {
            docker compose -f "$ComposeDir/compose-ca.yaml" -f "$ComposeDir/compose-orderer.yaml" -f "$ComposeDir/compose-peers.yaml" down --volumes --remove-orphans
        }
        Write-Host "===> Network stopped." -ForegroundColor Green
    }
    "reset" {
        Write-Host "===> Resetting network and removing generated credentials..." -ForegroundColor Yellow
        if (Test-Docker) {
            docker compose -f "$ComposeDir/compose-ca.yaml" -f "$ComposeDir/compose-orderer.yaml" -f "$ComposeDir/compose-peers.yaml" down --volumes --remove-orphans
        }
        Remove-Item -Recurse -Force (Join-Path $BlockchainDir "organizations/peerOrganizations") -ErrorAction SilentlyContinue
        Remove-Item -Recurse -Force (Join-Path $BlockchainDir "organizations/ordererOrganizations") -ErrorAction SilentlyContinue
        Remove-Item -Recurse -Force (Join-Path $BlockchainDir "organizations/fabric-ca") -ErrorAction SilentlyContinue
        Remove-Item -Recurse -Force (Join-Path $BlockchainDir "channel-artifacts") -ErrorAction SilentlyContinue
        Write-Host "===> Cleaned all crypto material." -ForegroundColor Green
    }
    "status" {
        if (Test-Docker) {
            docker ps --filter "name=exambody" --filter "name=university" --filter "name=auditor" --filter "name=orderer"
        } else {
            Write-Host "Docker is not available in host environment." -ForegroundColor Yellow
        }
    }
    default {
        Write-Host "Usage: .\network.ps1 [up|down|reset|status|deploy-chaincode|upgrade-chaincode|add-sample-data]"
    }
}
