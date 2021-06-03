const AWS = require('aws-sdk');
AWS.config.update( {
  region: 'us-east-1'
});
const dynamodb = new AWS.DynamoDB.DocumentClient();
const dynamodbTableName = 'product-inventory';
const dynamodbTableName2 = 'Message';
const healthPath = '/health';
const productPath = '/product';
const productsPath = '/products';

exports.handler = async function(event) {
  console.log('Request event: ', event);
  let response;
  switch(true) {
    case event.httpMethod === 'GET' && event.path === healthPath:
      response = buildResponse(200);
      break;
    case event.httpMethod === 'GET' && event.path === productPath:
      response = await getProduct(event.queryStringParameters.productId);
      break;
    case event.httpMethod === 'GET' && event.path === productsPath:
      response = await getProducts();
      break;
    case event.httpMethod === 'POST' && event.path === productPath:
      response = await saveProduct(JSON.parse(event.body));
      break;
    case event.httpMethod === 'PATCH' && event.path === productPath:
      const requestBody = JSON.parse(event.body);
      response = await modifyProduct(requestBody);
      break;
    case event.httpMethod === 'DELETE' && event.path === productPath:
      response = await deleteProduct(JSON.parse(event.body).productId);
      break;
    default:
      response = buildResponse(404, '404 Not Found');
  }
  return response;
}

/**
 * 
 * @param {String} productId 
 * @returns It returns the name of the product corresponding to the productId
 */
async function getProduct(productId) {
  const params = {
    TableName: dynamodbTableName,
    Key: {
      'productId': productId
    },
    ProjectionExpression: "product",
  }
  return await dynamodb.get(params).promise().then((response) => {
    return buildResponse(200, response.Item);
  }, (error) => {
    console.error('error: ', error);
  });
}

/**
 * 
 * @returns It returns all the products using scanDynamoRecords method
 */
async function getProducts() {
  const params = {
    TableName: dynamodbTableName
  }
  const allProducts = await scanDynamoRecords(params, []);
  const body = {
    products: allProducts
  }
  return buildResponse(200, body);
  /* const params = {
    RequestItems:{
      "Message" : {
        Keys:[
          {
            messageId:"9",
          }
        ]
      },
      "product-inventory" : {
        Keys:[
          {
            productId:"1",
          }
        ]
      }
    }
  };
  console.log(JSON.stringify(params));
  const demo=  await dynamodb.batchGet(params).promise();
  console.log(demo)
  return buildResponse(200,demo);
  */
}

/**
 * 
 * @param {Oject} scanParams 
 * @param {Array} itemArray 
 * @returns all the items using LastEvaluatedKey
 */
async function scanDynamoRecords(scanParams, itemArray) {
  try {
    const dynamoData = await dynamodb.scan(scanParams).promise();
    itemArray = itemArray.concat(dynamoData.Items);
    if (dynamoData.LastEvaluatedKey) {
      scanParams.ExclusiveStartkey = dynamoData.LastEvaluatedKey;
      return await scanDynamoRecords(scanParams, itemArray);
    }
    return itemArray;
  } catch(error) {
    console.error('error: ', error);
  }
}

/**
 * 
 * @param {event.body} requestBody 
 * @returns It store the product in the dynamodb table
 */
async function saveProduct(requestBody) {
  console.log(requestBody);
  const itemsArray = [];
    for (let i = 0; i < requestBody.productData.length; i++) {
        itemsArray.push({
            PutRequest: {
                Item: requestBody.productData[i]
            }
        });
    }
    console.log(itemsArray)
  const params = {
  RequestItems: {
    "product-inventory": itemsArray
  }
};

  console.log(JSON.stringify(params));
  const demo=  await dynamodb.batchWrite(params).promise();
  console.log(demo)
  return buildResponse(200,demo);
}

/**
 * 
 * @param {event.body} requestBody 
 * @returns It updates/modifies the table
 */
async function modifyProduct(requestBody) {
  const attributeValues ={};
  let condition;
  let updateExpression="SET ";
  //incase of remove, delete we use 
  //UpdateExpression : Remove attribute_name
  if(requestBody.product && requestBody){
    attributeValues[":product"]= requestBody.product;
    condition="product= :product";
    updateExpression=updateExpression+ condition + ",";
  }
  if(requestBody.quantity && requestBody){
    attributeValues[":quantity"]= requestBody.quantity;
    condition="quantity= :quantity";
    updateExpression=updateExpression+ condition ;
  }
  console.log(updateExpression);
  const params = {
    TableName: dynamodbTableName,
    Key: {
      'productId': requestBody.productId
    },
    UpdateExpression: updateExpression,
    ExpressionAttributeValues: attributeValues,
    ReturnValues: 'UPDATED_NEW'
  }
  console.log(params)
  return await dynamodb.update(params).promise().then((response) => {
    const body = {
      Operation: 'UPDATE',
      Message: 'SUCCESS',
      UpdatedAttributes: response
    }
    return buildResponse(200, body);
  }, (error) => {
    console.error('error: ', error);
  })
}

//async function concatConditions(updateExpression, condition, str){
//  console.log(updateExpression+condition+str)
//  return updateExpression+condition+str;
//}

/**
 * 
 * @param {String} productId 
 * @returns It deletes the product with the given Id from the database
 */
async function deleteProduct(productId) {
  const params = {
    TableName: dynamodbTableName,
    Key: {
      'productId': productId
    },
    ReturnValues: 'ALL_OLD'
  }
  return await dynamodb.delete(params).promise().then((response) => {
    const body = {
      Operation: 'DELETE',
      Message: 'SUCCESS',
      Item: response
    }
    return buildResponse(200, body);
  }, (error) => {
    console.error('error: ', error);
  })
}

/**
 * 
 * @param {Integer} statusCode 
 * @param {Oject} body 
 * @returns It returns JSON.strigify
 */
function buildResponse(statusCode, body) {
  return {
    statusCode: statusCode,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  }
}
