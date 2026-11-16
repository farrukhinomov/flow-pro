#!/usr/bin/env bash

set -euo pipefail

dotnet tool restore
dotnet restore FlowPro.slnx
dotnet format FlowPro.slnx --verify-no-changes --no-restore
dotnet build FlowPro.slnx --configuration Release --no-restore
dotnet test FlowPro.slnx --configuration Release --no-build
dotnet list FlowPro.slnx package --vulnerable --include-transitive
dotnet tool run dotnet-ef migrations has-pending-model-changes \
  --project src/FlowPro.Infrastructure/FlowPro.Infrastructure.csproj \
  --startup-project src/FlowPro.Api/FlowPro.Api.csproj \
  --configuration Release \
  --no-build
