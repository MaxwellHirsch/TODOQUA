$(function main() {
    var client = ZAFClient.init();
    client.invoke('resize', { width: '100%', height: '200px' });
    
    var depsPromise = compileDependencies(client);
    
    var checkStatePromise = Promise.all([
        depsPromise
    ]).spread((deps) => {
        return checkStateAsync(deps);
    })
    
    var installPromise = Promise.all([
        depsPromise,
        checkStatePromise
    ]).spread((deps, checkState) => {
        var shouldInstall = (checkState.path == '/install');
        return shouldInstall
            ? installAsync(deps)
                .then(() => {
                    console.log('Install complete, now update app config with step 1');
                    return updateAppConfigurationAsync(deps, 1, true)
                })
            : true;
    });

    var hasConfigPromise = Promise.all([
        depsPromise,
        installPromise
    ]).spread((deps, installData) => {
        return updateAccountAsync(deps)
            .then(() => true) // Has config
            .catch((err) => {
                if (err.status == 404) {
                    return false;
                } else {
                    throw err;
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
            authorizeAsync(deps)
                .then(() => new Promise((resolve) => window.setTimeout(resolve, 3000)))
                .then(() => updateAccountAsync(deps))
                .then(() => updateAppConfigurationAsync(deps))
                .then(() => startReact(deps))
                .catch((err) => {
                    uninstallAsync(deps);
                });
        }
    });
});

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
                configName: `${channelName}:${deps.userId}`
            };
        })
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

function checkStateAsync(deps) {
    var invokeMainFloQuery = {
        url: `https://api.azuqua.com/flo/ffcd4dffc594621149b95ceb3fcd0857/invoke`, // 00. Check State
        cors: true,
        type: 'post',
        dataType: 'json',
        data: {
            token: '',
            origin: deps.origin,
            app_guid: deps.appGuid,
            userId: deps.userId
        }
    };
    return deps.client.request(invokeMainFloQuery)
}

function installAsync(deps) {
    var invokeInstallFloQuery = {
        url: `https://api.azuqua.com/flo/969a769ba4d6a7c7f61b5b3aab647b3c/invoke`, // 02. Install Process
        cors: true,
        type: 'post',
        dataType: 'json',
        data: {
            instanceName: deps.instanceName,
            instanceId: deps.instanceId,
            token: deps.token,
            origin: deps.origin,
            userId: deps.userId
        }
    };
    return deps.client.request(invokeInstallFloQuery);
}

function updateAccountAsync(deps) {
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
            accountName: deps.configName,
            token: deps.token,
            origin: deps.origin,
            useId: deps.userId
        }
    };
    return deps.client.request(invokeUpdateConfigFloQuery)
}

function authorizeAsync(deps) {
    var authorizeLink = `https://designer2.azuqua.com/app/oauth/${deps.channelName}/authorize?app_token=${deps.appToken}&orgId=${deps.orgId}&configName=${deps.configName}&version=${deps.channelVersion}&subdomain=${deps.subdomain}`;
    var authWindow = window.open(authorizeLink, 'Authorize to Google Tasks', 'resizable,scrollbars,status, width=650, height=400');
    if (authWindow.focus) {
        authWindow.focus();
    }

    return new Promise(function(resolve, reject) {
        var timer = window.setInterval(function () {
            if (authWindow.closed !== false) {
                window.clearInterval(timer);
                resolve();
            }
        }, 200);
    });
}

function updateAppConfigurationAsync(deps, stepNumber, completed) {
    var invokeUpdateAppConfigFloQuery = {
        url: `https://api.azuqua.com/flo/282b0a132307c678927afcffc5a51d30/invoke`, // 04. Update Configuration
        cors: true,
        type: 'post',
        dataType: 'json',
        data: {
            stepNumber,
            completed,
            instanceId: deps.instanceId,
            token: deps.token,
            origin: deps.origin,
            userId: deps.userId
        }
    };
    return deps.client.request(invokeUpdateAppConfigFloQuery);
}

function uninstallAsync(deps) {
    var invokeUninstallFloQuery = {
        url: `https://api.azuqua.com/flo/b5c856d940aa2fbc16be3cc145dab703/invoke`, // 06. Uninstall
        cors: true,
        type: 'post',
        dataType: 'json',
        data: {
            instanceId: deps.instanceId,
            token: deps.token,
            origin: deps.origin,
            userId: deps.userId
        }
    };
    return deps.client.request(invokeUninstallFloQuery);
}

function startReact(deps) {
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
        
        this.state = {
            taskItems: [],

            // ticketURL -> Send on every request (empty string initially)
            // parentId -> send on every request (even if it's empty string)
        }
    }

    onCheckTask() {
        //TODO: make FLO call
    }

    onUpdateTaskText() {
        // TODO: make FLO call
    }
        
    render() {
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