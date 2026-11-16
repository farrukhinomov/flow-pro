# Build context: the repository root.
# The build stage always runs on the builder's own architecture and
# cross-compiles for the target, so ARM images build without emulation.
FROM --platform=$BUILDPLATFORM mcr.microsoft.com/dotnet/sdk:10.0.404 AS build
ARG TARGETARCH
WORKDIR /source

COPY apps/api/ .
RUN --mount=type=cache,target=/root/.nuget/packages,sharing=locked \
    dotnet publish src/FlowPro.Worker/FlowPro.Worker.csproj \
        --configuration Release \
        --arch "$TARGETARCH" \
        --output /app/publish \
        /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/runtime:10.0 AS final
WORKDIR /app
USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgssapi-krb5-2 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/publish .
USER $APP_UID
ENTRYPOINT ["dotnet", "FlowPro.Worker.dll"]
