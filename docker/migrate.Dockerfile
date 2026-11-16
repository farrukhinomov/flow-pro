# Build context: the repository root.
# One-shot image that applies pending database migrations and exits. It runs
# before the API and worker start, so a failed migration stops a deployment
# instead of leaving a crashing API.
FROM --platform=$BUILDPLATFORM mcr.microsoft.com/dotnet/sdk:10.0.404 AS build
ARG TARGETARCH
WORKDIR /source

COPY apps/api/ .
RUN --mount=type=cache,target=/root/.nuget/packages,sharing=locked \
    dotnet tool restore \
    && dotnet restore FlowPro.slnx \
    && dotnet tool run dotnet-ef migrations bundle \
        --project src/FlowPro.Infrastructure/FlowPro.Infrastructure.csproj \
        --startup-project src/FlowPro.Api/FlowPro.Api.csproj \
        --configuration Release \
        --target-runtime "linux-$( [ "$TARGETARCH" = "amd64" ] && echo x64 || echo "$TARGETARCH" )" \
        --output /app/efbundle

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app/efbundle ./efbundle
COPY --from=build /source/src/FlowPro.Api/appsettings.json ./appsettings.json
USER $APP_UID
# The connection string comes from the same variable the API uses.
ENTRYPOINT ["/bin/sh", "-c", "exec ./efbundle --connection \"$ConnectionStrings__FlowPro\""]
