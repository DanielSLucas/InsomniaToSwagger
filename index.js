const fs = require('fs');
const insomniaFile = require('./Insomnia_2021-08-16.json');

const workspace = insomniaFile.resources.find(resource => resource._type === "workspace");

function formataTitulo(titulo) {
  const tituloEmMinusculo = titulo.toLowerCase();

  const endOfWordWithoutPluraIndex = tituloEmMinusculo.endsWith("es") ? tituloEmMinusculo.length - 2 : tituloEmMinusculo.length - 1;

  const tituloComPrimeiraLetraMaiuscula = tituloEmMinusculo
    .charAt(0).toUpperCase() + tituloEmMinusculo.slice(1, endOfWordWithoutPluraIndex);

  return tituloComPrimeiraLetraMaiuscula;
}

function isEmpty(obj) {
  return Object.keys(obj).length === 0;
}

const requests = insomniaFile.resources.filter(resource => resource._type === "request");

const apiRoutes = requests.map(resource => { 
  const parameters = [];
  const splitedUrl = resource.url.split("/");
  const lastRouteResource = splitedUrl[splitedUrl.length - 1];

  if (lastRouteResource.length === 36) {
    splitedUrl[splitedUrl.length - 1] = "{id}"
  }

  splitedUrl.splice(0, 1);
  const route =  "/" + splitedUrl.join("/");
  const routeTitle = formataTitulo(splitedUrl[0])
  if(route.endsWith("{id}")) {
    parameters.push({
      "name": "id",
      "in": "path",
      "description": `${routeTitle} id`,
      "required": true,
      "schema": {
        "type": "string"
      }
    })
  }

  if (resource.parameters.length > 0) {
    resource.parameters.forEach(parameter => {
      parameters.push({
        "name": parameter.name,
        "in": "query",
        "description": parameter.description,
        "required": true,
        "schema": {
          "type": "string"
        }
      })
    })
  }

  const security = resource.authentication.type === 'bearer' ? [{"bearerAuth": []}] : [];

  const requestBody = {};

  if (!isEmpty(resource.body)) {
    const body = JSON.parse(resource.body.text);
    const bodyKeys = Object.keys(body);

    const propertiesArray = bodyKeys.map(key => {
      return [key, {"type": typeof body[key]}];
    });

    const properties = Object.fromEntries(propertiesArray);

    Object.assign(requestBody, {
      "content": {
        [resource.body.mimeType]: {
          "schema": {
            "type": "object",
            properties,
            "example": {
              ...body
            }
          }
        }
      }
    });
  }

  const info = {
    [resource.method.toLowerCase()]: {
      "tags": [
        routeTitle
      ],
      "summary": resource.name,
      "description": resource.description,
      security,
      parameters,
      requestBody,
      "responses": {
        [resource.method.toLowerCase() === 'post' ? 201 : 200]: {
          "description": resource.method.toLowerCase() === 'post' ? "Created" : "OK"
        },
        "400": {
          "description": "Bad Request"
        },
        "401": {
          "description": "Unauthorized"
        },
        "429": {
          "description": "Too Many Requests"
        },
        "500": {
          "description": "Internal Server Error"
        }
      }
    },
  }

  if (info[resource.method.toLowerCase()].security.length === 0) {
    delete info[resource.method.toLowerCase()].security
  }

  if (info[resource.method.toLowerCase()].parameters.length === 0) {
    delete info[resource.method.toLowerCase()].parameters
  }

  if (Object.keys(info[resource.method.toLowerCase()].requestBody).length === 0) {
    delete info[resource.method.toLowerCase()].requestBody
  }
  
  return [route, info];
});

const newApiRoutes = [];

apiRoutes.forEach((route, index) => {
  const newRouteIndex = newApiRoutes.findIndex(newRoute => newRoute[0] === route[0]);
  
  if (newRouteIndex !== -1) {
    return newApiRoutes[newRouteIndex][1] = {
      ...newApiRoutes[newRouteIndex][1],
      ...route[1]
    }
  }

  newApiRoutes.push(route);
})

const paths = Object.fromEntries(newApiRoutes);

const swaggerFile = {
  "openapi": "3.0.0",
  "info": {
    "title": workspace.name,
    "description": workspace.description,
    "version": "1.0.0",
    "contact": {
      "email": "daniellucas-pms@hotmail.com"
    }
  },
  paths,
  "components": {
    "securitySchemes": {
      "bearerAuth": {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT"
      }
    }
  }
}

fs.writeFileSync('./swagger.json', JSON.stringify(swaggerFile));