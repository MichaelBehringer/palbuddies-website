FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY *.go ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /palbuddies-gb .

# Nur die statische Binary, ohne Shell und ohne root
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /palbuddies-gb /palbuddies-gb
EXPOSE 8000
ENTRYPOINT ["/palbuddies-gb"]
