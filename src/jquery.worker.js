$.fn.worker = function(options){

	var _ref = this;
	var _worker = null;

	//extend default options
	options = $.extend(true, {
		onStart: $.noop,
		onMessage: $.noop
	}, options);

	var _passthruProxy = {
		key: function(data){
			var si = data.indexOf(":")+1;
			var ei = data.indexOf(":", si);
			return data.substring(si,ei);
		},
		get: function(invoke, callback){
			callback(invoke());
		},
		set: function(invoke){
			invoke();
		}
	};

	//method for starting the worker
	_ref.start = function(){
		if(!Worker || !Blob || !URL){
			//workers not supported, invoke directly
			options.onStart(_passthruProxy);
		}
		else {

			var proxyCode = "var proxy = { \
                                stack: {}, \
								key: function(data){ \
									var si = data.indexOf(\":\")+1; \
									var ei = data.indexOf(\":\", si); \
									return data.substring(si,ei); \
								}, \
								get: function(invoke, callback){ \
									var key = new Date().getTime() + \"-\" + Math.random(); \
									proxy.stack[key] = callback; \
									postMessage(\"invoke-get:\" + key + \":\" + invoke.toString()); \
								}, \
								set: function(invoke){ \
									postMessage(\"invoke-set:\" + invoke.toString()); \
								} \
							}; \
							\
							onmessage = function(event){ \
								var dataString = event.data.toString(); \
								if(dataString.indexOf(\"invoke-get:\") == 0){ \
									var key = proxy.key(dataString); \
									var returnValue = dataString.replace(\"invoke-get:\" + key + \":\", \"\"); \
									proxy.stack[key](eval(\"(\" + returnValue + \")\")); \
									delete proxy.stack[key]; \
								} \
								else { \
									if(receiveMessage) \
										receiveMessage(event); \
								} \
							} \
							";

			var functionCode = options.onStart.toString();
			var functionCode = functionCode.substring(functionCode.indexOf("{")+1);
			functionCode = "function(){ " + proxyCode + functionCode;

			var workerCode = "(" + functionCode + ")()";
			var blob = new Blob([workerCode]);
			_worker = new Worker(URL.createObjectURL(blob));
			_worker.onmessage = function(event){

				var dataString = event.data.toString();
				if(dataString.indexOf("invoke-get:") == 0){
					var key = _passthruProxy.key(dataString);
					var code = dataString.replace("invoke-get:" + key + ":", "");
					var si = code.indexOf("{")+1;
					var li = code.lastIndexOf("}");
					var codeBody = code.substring(si,li);
					var r = new Function(codeBody)();
					_worker.postMessage("invoke-get:" + key + ":" + JSON.stringify(r));
				}
				else if(dataString.indexOf("invoke-set:") == 0){
					code = dataString.replace("invoke-set:", "");
					var si = code.indexOf("{")+1;
					var li = code.lastIndexOf("}");
					var codeBody = code.substring(si,li);
					new Function(codeBody)();
				}
				else {
					options.onMessage(event);
				}
			}
		}
	}

	//method for stopping the worker
	_ref.stop = function(){
		_worker.terminate();
	}

	//method for posting a message to the worker
	_ref.postMessage = function(data){
		_worker.postMessage(data);
	}

	//method for retrieving the worker object
	_ref.getWorker = function(){
		return _worker;
	}

	return _ref;
}
