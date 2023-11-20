#!/bin/bash

# Endpoint URLs
SOLVE_PROBLEM_URL="http://localhost:6969/solve_problem"
GET_RESPONSE_URL="http://localhost:6969/get_response"

# Function to make solve_problem requests with different bodies
make_request() {
    local body=$1
    response=$(curl -s -X POST "$SOLVE_PROBLEM_URL" \
        -H "Content-Type: application/json" \
        -d "$body")
    request_id=$(echo $response | jq -r '.requestId')
    echo $request_id
}

# Function to poll for a response
poll_response() {
    local request_id=$1
    response=$(curl -s "$GET_RESPONSE_URL/$request_id")
    echo "Response for Request ID $request_id: $response"
}

# Array of different request bodies
declare -a bodies=(
    '{"language": "Python", "code": "def add(a, b):\\n    return a + b\\n", "userText": "How can I improve this function?", "userLevel": "beginner", "question": "Simple Addition Function", "questionDescription": "Create a function that adds two numbers."}'
    '{"language": "JavaScript", "code": "function isPrime(num) {\\n  for (let i = 2; i < num; i++)\\n    if (num % i === 0) return false;\\n  return num > 1;\\n}", "userText": "Can this be optimized?", "userLevel": "intermediate", "question": "Prime Number Check", "questionDescription": "Function to check if a number is prime."}'
    '{"language": "Java", "code": "public class HelloWorld {\\n public static void main(String[] args) {\\n  System.out.println(\\"Hello, World!\\");\\n }\\n}", "userText": "Is this the correct way to print in Java?", "userLevel": "beginner", "question": "Hello World Program", "questionDescription": "Basic Java program to print Hello World."}'
    # Add more request bodies as needed
)

# Send requests with different bodies
for body in "${bodies[@]}"
do
    echo "Sending Request with body: $body"
    request_id=$(make_request "$body")
    echo "Received Request ID: $request_id"
    poll_response $request_id # Poll immediately for each request
done
