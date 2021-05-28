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

async function getProduct(productId) {
  const params = {
    TableName: dynamodbTableName,
    Key: {
      'productId': productId
    }
  }
  return await dynamodb.get(params).promise().then((response) => {
    return buildResponse(200, response.Item);
  }, (error) => {
    console.error('error: ', error);
  });
}

async function getProducts() {
  const params = {
    RequestItems:{
      dynamodbTableName : {
        Keys: [
          {
            productId:"2"
          }
        ]
      },
      dynamodbTableName2 : {
        Keys:[
          {
            messageId:"9",
          }
        ]
      }
    }
  };
  console.log(params);
  return await dynamodb.batchGet(params).promise().then((response) => {
    console.log(response);
    return buildResponse(200, response.Responses);
  }, (error) => {
    console.error('error: ', error);
  });
}

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

async function saveProduct(requestBody) {
  console.log(requestBody);
  const params = {
    TableName: dynamodbTableName,
    Item: requestBody
  }
  return await dynamodb.put(params).promise().then(() => {
    const body = {
      Operation: 'SAVE',
      Message: 'SUCCESS',
      Item: requestBody
    }
    return buildResponse(200, body);
  }, (error) => {
    console.error('error: ', error);
  })
}

async function modifyProduct(requestBody) {
  const attributeValues ={};
  let condition;
  let updateExpression="SET ";
  if(requestBody.product && requestBody){
    attributeValues[":product"]= requestBody.product;
    condition="product= :product";
    updateExpression=updateExpression+ condition + ",";
  }
  if(requestBody.quantity && requestBody){
    attributeValues[":quantity"]= requestBody.quantity;
    condition="quantity= :quantity";
    updateExpression=updateExpression+ condition + ",";
  }
  console.log(updateExpression);
  const params = {
    TableName: dynamodbTableName,
    Key: {
      'productId': requestBody.productId
    },
    UpdateExpression: updateExpression,
    ExpressionAttributeValues: {
      attributeValues
    },
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

function buildResponse(statusCode, body) {
  return {
    statusCode: statusCode,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  }
}
