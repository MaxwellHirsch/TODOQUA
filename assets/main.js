// var fetchItem = {
    //     url: 'https://api.azuqua.com/flo/3478718f4d933b11a26c2ecb360a53fa/invoke?clientToken=e95724281f8300a06698fda4c0a3615bdf4589094af1c96ee8919a20aeb245db',
    //     cors: true,
    //     type: 'POST',
    //     dataType: 'json'
    // };

    //   client.request(fetchItem)
    //     .then(function (data) {
    //         console.log(data);
    //     }, 
    //     function (err) {
    //         console.log(err);
        //  })

$(function() {
    var client = ZAFClient.init();
    client.invoke('resize', { width: '100%', height: '200px' });
    
    var depsPromise = compileDependencies(client);
    
    test(depsPromise);
    return;
    
    
    
    
    
    
    
    
    var nextActionPromise = getNextAction(depsPromise);
    var installPromise = Promise.all([
        depsPromise,
        nextActionPromise
    ]).spread((deps, nextAction) => {
        var installPromise = Promise.resolve(true);
        if (nextAction.path == '/install') {
            var invokeInstallFloQuery = {
                url: `https://api.azuqua.com/flo/969a769ba4d6a7c7f61b5b3aab647b3c/invoke`, // 02. Install Process
                cors: true,
                type: 'post',
                dataType: 'json',
                data: {
                    instanceName: deps.instanceName,
                    instanceId: deps.instanceId,
                    token: deps.token,
                    origin: deps.origin
                }
            };
            console.log('Calling 02 install process with: ');
            console.log(invokeInstallFloQuery);
            installPromise = deps.client.request(invokeInstallFloQuery)
                .tap((res) => {
                    console.log('Called 02. Install Process');
                    console.log(res);
                });
        }
        return installPromise;
    });

    var hasConfigPromise = Promise.all([
        depsPromise,
        installPromise
    ]).spread((deps, installData) => {
        var invokeUpdateConfigFloQuery = {
            url: `https://api.azuqua.com/flo/b9d3ce21664c5b35d64bb0032acc7d66/invoke`, // 03. Update Account
            cors: true,
            type: 'post',
            dataType: 'json',
            data: {
                instanceId: deps.instanceId,
                connectorName: deps.channelName,
                accountId: deps.accountId,
                connectorVersion: deps.channelVersion,
                accountName: deps.accountName,
                token: deps.token,
                origin: deps.origin
            }
        };
        console.log('Calling update account (03) to check if account exists');
        console.log(invokeUpdateConfigFloQuery);
        console.log(deps);
        return deps.client.request(invokeUpdateConfigFloQuery)
            .tap((res) => {
                console.log('Called upate account initially');
                console.log(res);
            })
            .then(() => true) // Has config
            .catch((err) => {
                var statusCode = err.statusCode;
                if (statusCode == 404) {
                    return false;
                }
            })
    });

    Promise.all([
        depsPromise,
        hasConfigPromise
    ]).spread((deps, hasConfig) => {
        if (hasConfig) {
            startReact(deps);
        } else {
            var authorizeLink = `https://designer2.azuqua.com/app/oauth/${deps.channelName}/authorize?app_token=${deps.appToken}&orgId=${deps.orgId}&configName=${deps.configName}&version=${deps.channelVersion}&subdomain=${deps.subdomain}`;
            console.log('Authorize link'); console.log(authorizeLink);
            var authWindow = window.open(authorizeLink, 'Authorize to Google Tasks', 'resizable,scrollbars,status, width=650, height=400');
            authWindow.addEventListener('unload', function(ev) {
                
                var invokeUpdateConfigFloQuery = {
                    url: `https://api.azuqua.com/flo/b9d3ce21664c5b35d64bb0032acc7d66/invoke`, // 03. Update Account
                    cors: true,
                    type: 'post',
                    dataType: 'json',
                    data: {
                        instanceId: deps.instanceId,
                        connectorName: deps.channelName,
                        accountId: deps.accountId,
                        connectorVersion: deps.channelVersion,
                        accountName: deps.accountName,
                        token: deps.token,
                        origin: deps.origin
                    }
                };
                console.log('Calling update account (03) - 2nd time - with: ');
                console.log(invokeUpdateConfigFloQuery);
                console.log('With event');
                console.log(ev);
                deps.client.request(invokeUpdateConfigFloQuery)
                    .then(() => {
                        startReact(deps);
                    });
            })

        }
    });
});

function test(depsPromise) {
    depsPromise.then((deps) => {
        $('#init').on('click', function() {

        var authorizeLink = `https://designer2.azuqua.com/app/oauth/${deps.channelName}/authorize?app_token=${deps.appToken}&orgId=${deps.orgId}&configName=${deps.configName}&version=${deps.channelVersion}&subdomain=${deps.subdomain}`;
        console.log('Authorize link'); console.log(authorizeLink);
        var authWindow = window.open(authorizeLink, 'Authorize to Google Tasks', 'resizable,scrollbars,status, width=650, height=400');
            if (authWindow.focus) {
                authWindow.focus();
            }
            authWindow.onunload = function(ev) {
                
                var invokeUpdateConfigFloQuery = {
                    url: `https://api.azuqua.com/flo/b9d3ce21664c5b35d64bb0032acc7d66/invoke`, // 03. Update Account
                    cors: true,
                    type: 'post',
                    dataType: 'json',
                    data: {
                        instanceId: deps.instanceId,
                        connectorName: deps.channelName,
                        accountId: deps.accountId,
                        connectorVersion: deps.channelVersion,
                        accountName: deps.accountName,
                        token: deps.token,
                        origin: deps.origin
                    }
                };
                console.log('Calling update account (03) - 2nd time - with: ');
                console.log(invokeUpdateConfigFloQuery);
                console.log('With event');
                console.log(ev);
                deps.client.request(invokeUpdateConfigFloQuery)
                    .then(() => {
                        startReact(deps);
                    });
            }
        
        })

        }).catch(console.log)
}

function compileDependencies(client) {
    return client.get('ticket.requester.id')
        .then((data) => {
            const userId = _.get(data, 'ticket.requester.id');
            var token = getParameterByName('token');
            var origin = getParameterByName('origin');
            var appGuid = getParameterByName('app_guid');
            
            return {
                userId,
                token,
                origin,
                appGuid,
            };
        })
        .then((deps) => {
            var userInfoRequest = {
                url: `/api/v2/users/${deps.userId}.json`,
                type:'GET',
                dataType: 'json',
            };
            return client.request(userInfoRequest)
                .then((userInfo) => {
                    return {
                        ...deps,
                        userInfo
                    };
                });
        })
        .then((deps) => {
            return client.get('instances')
                .then((instances) => {
                    return {
                        ...deps,
                        instances
                    }
                })
        })
        .then((deps) => {
            return client.context()
                .then((context) => {
                    return {
                        ...deps,
                        zendeskContext: context
                    };
                });
        })
        .then((deps) => {
            return {
                ...deps,
                client
            };
        })
        .then((deps) => {
            const subdomain = _.get(deps, 'zendeskContext.account.subdomain');
            const channelName = 'googletasks2_6163';
            return {
                ...deps,

                instanceName: `${subdomain}.zendesk.com`,
                subdomain,
                channelName,
                channelVersion: '1.0.2',
                orgId: 6163,
                appToken: 'azq_apps',
                configName: `${channelName}-${deps.userId}`
            };
        })
        .tap((deps) => {
            console.log("Returning from compileDeps with:");
            console.log(deps);
        });
}

function getNextAction(depsPromise) {
    return depsPromise
        .then((deps) => {
            var invokeMainFloQuery = {
                url: `https://api.azuqua.com/flo/ffcd4dffc594621149b95ceb3fcd0857/invoke`, // 00. Check State
                cors: true,
                type: 'post',
                dataType: 'json',
                data: {
                    token: '',
                    origin: deps.origin,
                    app_guid: deps.appGuid,
                }
            };
            console.log('Calling 00 check state with');
            console.log(invokeMainFloQuery);
            return deps.client.request(invokeMainFloQuery)
                .tap((d) => {
                    console.log('Finished checking state: 00. Check State, with: ');
                    console.log(d);
                });
        });
}

function getParameterByName(name, url) {
  if (!url) url = window.location.href;
  name = name.replace(/[\[\]]/g, "\\$&");
  var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
  results = regex.exec(url);
  if (!results) return null;
  if (!results[2]) return '';
  return decodeURIComponent(results[2].replace(/\+/g, " "));
}

function startReact(deps) {
    console.log(deps);
    ReactDOM.render(
        <MainApp {...deps} />,
        document.getElementById('container')
    );
}

const mockTaskItems = [
    {

    }
];

class MainApp extends React.Component {

    constructor(props, ctx) {
        super(props, ctx);

        const userId = _.get(this.props, 'userId');
        const subdomain = _.get(this.props, 'zendeskContext.account.subdomain');
        const channelName = 'googletasks2_6163';
        this.state = {
            taskItems: [],
            isAuthenticating: false,

            // ticketURL -> Send on every request (empty string initially)
            // parentId -> send on every request (even if it's empty string)
            instanceName: `${subdomain}.zendesk.com`,
            subdomain,
            channelName,
            channelVersion: '1.0.2',
            orgId: 6163,
            appToken: 'azq_apps',
            configName: `${channelName}:${userId}`
        }
    }

    openOAuth() {
        const {
            subdomain,
            channelName,
            channelVersion,
            orgId,
            appToken,
        } = this.state;
        

        this.setState({
            isAuthenticating: true
        });

        const authorizeLink = `https://designer2.azuqua.com/app/oauth/${channelName}/authorize?app_token=${appToken}&orgId=${orgId}&configName=${configName}&version=${channelVersion}&subdomain=${subdomain}`;
        const authWindow = window.open(authorizeLink, 'Authorize to Google Tasks', 'resizable,scrollbars,status, width=650, height=400');
        authWindow.onunload = this.handleOAuth.bind(this);
    }

    handleOAuth() {
        const { client } = this.props;
        // TODO: Add query for 03: FLO

        client.request()
            .then(() => {

            });
    }

    onCheckTask() {
        //TODO: make FLO call
    }

    onUpdateTaskText() {
        // TODO: make FLO call
    }
        
    render() {
        if (this.state.isAuthenticating) {
            return (
                <div>
                    Please wait, currently authorizing to Google Tasks...
                </div>
            );
        }

        const { userInfo } = this.props;
        const { name } = userInfo.user;

        const { taskItems } = this.state;
        const hasTaskItems = !_.isEmpty(taskItems);
        const nextTaskItemKey = taskItems.length;
        const taskList = 'Andrews Task List';
        return (
            <div className="main-app container">    
                <div className="row">
                    <div className="col">
                        <h1> {taskList} </h1>
                    </div>
                </div>

                { hasTaskItems &&
                    _.forEach(taskItems, function(taskItemData, key) {
                        return (
                            <TaskItem
                                key={key}
                                taskText={taskItemData.text}
                                onCheckTask={this.onCheckTask.bind(this)}
                                onUpdateTaskText={this.onUpdateTaskText.bind(this)}
                            />
                        )
                    })
                }

                <TaskItem
                    isNewTask={true}
                    key={nextTaskItemKey}
                    taskText=""
                    onCheckTask={this.onCheckTask.bind(this)}
                    onUpdateTaskText={this.onUpdateTaskText.bind(this)}
                />
            </div>
        );
    }
};

class TaskItem extends React.Component{

    constructor(props, ctx) {
        super(props, ctx);

        this.state = {
            isChecked: props.isChecked,
            taskText: props.taskText
        }
    }

    updateTaskText(e) {
        const newTaskText = e.target.value;
        console.log(newTaskText);
        this.setState({
            taskText: newTaskText
        });
        this.props.onUpdateTaskText();
    }

    toggleTaskChecked() {
        const prevIsChecked = this.state.isChecked;
        this.setState({
            isChecked: !prevIsChecked
        });
        this.props.onCheckTask();
    }

    render() {
        const { className, key } = this.props;

        return (
            <div className="row">
                <div className={`col c-chk c-chk--nolabel ${className}`}>
                    <input className="c-chk__input" id={`chk-${key}`} type="checkbox" value={this.state.isChecked}/>
                    <label className="c-chk__label" dir="ltr" for={`chk-${key}`} onChange={this.toggleTaskChecked.bind(this)}></label>
                    <input
                        className="task-text"
                        value={this.state.taskText}
                        onChange={this.updateTaskText.bind(this)}    
                    />
                </div>
            </div>
        );
    }
}

class TodoEditor extends React.Component{
    constructor(props, ctx) {
        super(props, ctx);

        this.state = {
            
        }
    }

    render() {
        return (
            <div>

            </div>
        );
    }
}