SWAGGER_JSON=./docs/swagger.json
OPENAPI_JSON=./docs/openapi.json

SWAG=swag
SWAGGER2OPENAPI=swagger2openapi

.PHONY: all docs convert clean seal-secret

all: docs convert

docs:
	@echo "Generating Swagger 2.0 docs..."
	$(SWAG) init -g cmd/api/main.go --parseDependency --output ./docs --outputTypes json

convert:
	@echo "Converting Swagger 2.0 to OpenAPI 3.0..."
	$(SWAGGER2OPENAPI) -p -o $(OPENAPI_JSON) $(SWAGGER_JSON)

clean:
	@echo "Cleaning docs..."
	rm -rf ./docs/swagger.json ./docs/openapi.json ./docs/docs.go

seal-secret:
	kubectl create secret generic wellie-api-secrets --dry-run=client --from-file=config.yml=config.production.yml -o yaml | \
	kubeseal \
		--controller-name=sealed-secrets \
		--controller-namespace=kube-system \
		--format yaml > deployment/secret.yaml