import json, base64, subprocess, os
os.environ.update(AWS_PROFILE='envhack', AWS_REGION='ap-south-1', AWS_DEFAULT_REGION='ap-south-1', MSYS_NO_PATHCONV='1')
os.chdir('d:/CC Project/deck/evidence')
common = {"region": "ap-south-1", "period": 300, "start": "-PT6H", "end": "PT0H", "width": 900, "height": 340, "yAxis": {"left": {"min": 0}}}
API, WS = 'qn8kojdbz1', 'fm9t3x41m6'
widgets = {
    'cw-api': {"title": "API Gateway: requests and 4xx (throttled)", "metrics": [["AWS/ApiGateway", "Count", "ApiId", API, {"stat": "Sum", "label": "Requests"}], ["AWS/ApiGateway", "4xx", "ApiId", API, {"stat": "Sum", "label": "4xx (throttled)"}]]},
    'cw-lambda': {"title": "Lambda relief-api: invocations, errors, concurrency", "metrics": [["AWS/Lambda", "Invocations", "FunctionName", "relief-api", {"stat": "Sum"}], ["AWS/Lambda", "Errors", "FunctionName", "relief-api", {"stat": "Sum"}], ["AWS/Lambda", "ConcurrentExecutions", "FunctionName", "relief-api", {"stat": "Maximum"}]]},
    'cw-latency': {"title": "API Gateway latency p50 / p95 (ms)", "metrics": [["AWS/ApiGateway", "Latency", "ApiId", API, {"stat": "p50"}], ["AWS/ApiGateway", "Latency", "ApiId", API, {"stat": "p95"}]]},
    'cw-ddb': {"title": "DynamoDB relief-incidents: consumed capacity (on-demand)", "metrics": [["AWS/DynamoDB", "ConsumedReadCapacityUnits", "TableName", "relief-incidents", {"stat": "Sum"}], ["AWS/DynamoDB", "ConsumedWriteCapacityUnits", "TableName", "relief-incidents", {"stat": "Sum"}]]},
    'cw-ws': {"title": "WebSocket API: connections and pushed messages", "metrics": [["AWS/ApiGateway", "MessageCount", "ApiId", WS, "Stage", "prod", {"stat": "Sum"}], ["AWS/ApiGateway", "ConnectCount", "ApiId", WS, "Stage", "prod", {"stat": "Sum"}]]},
}
for name, w in widgets.items():
    spec = {**common, **w, "view": "timeSeries"}
    r = subprocess.run(['aws', 'cloudwatch', 'get-metric-widget-image', '--metric-widget', json.dumps(spec), '--output', 'json'], capture_output=True, text=True)
    if r.returncode:
        print(name, 'FAILED', r.stderr[:200]); continue
    open(name + '.png', 'wb').write(base64.b64decode(json.loads(r.stdout)['MetricWidgetImage']))
    print(name, os.path.getsize(name + '.png'))
