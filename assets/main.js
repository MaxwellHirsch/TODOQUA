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
            return authorizeAsync(deps)
                .then(() => updateAccountAsync(deps))
                .then(() => updateAppConfigurationAsync(deps, 1, true))
                .then(() => startReact(deps))
                .catch((err) => {
                    uninstallAsync(deps);
                });
                
        }
    })
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
                        userInfo: userInfo.user
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
            return client.get('ticket')
                .then((data) => {
                    return {
                        ...deps,
                        ticketData: data.ticket
                    }
                })
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
                configName: `${channelName}::${deps.userId}`
            };
        })
        .tap((deps) => {
            console.log(deps);
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
            userId: deps.userId
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
        

        const { userId } = props;
        const ticketId = _.get(props, 'ticketData.id');
        const customFields = _.get(props, 'ticketData.custom_fields', []);
        const customField = _.find(customFields, (obj) => (obj.id == userId));
        const parentId = _.get(customField, 'value', '');

        this.state = {
            taskItems: [],
            parentId,
            hasParent: !!parentId, // parentId -> send on every request (even if it's empty string)
            isLoadingTasks: true,
            ticketUrl: `${props.origin}/agent/tickets/${ticketId}`, // ticketURL -> Send on every request (empty string initially)
        }

        this.onCheckTask = this.onCheckTask.bind(this);
        this.onUpdateTaskTitle = _.debounce(this.onUpdateTaskTitle.bind(this), 500); // 0.5 second debounce
        this.loadTaskItems = this.loadTaskItems.bind(this);
        this.onCreateTask = this.onCreateTask.bind(this);
    }

    componentDidMount() {
        this.loadTaskItems();
    }

    loadTaskItems() {
        const { client, userId } = this.props;

        const invokeGetTaskItemsFloQuery = {
            url: `https://api.azuqua.com/flo/bc20c39dd90c59ca6b0fed8b34debe54/invoke`, // FLO Router
            cors: true,
            type: 'post',
            dataType: 'json',
            data: {
                action: 'get',
                parentId: this.state.parentId,
                userId
            }
        };
        client.request(invokeGetTaskItemsFloQuery)
            .then((taskItems) => {
                console.log(taskItems);
                this.setState({
                    taskItems,
                    isLoadingTasks: false
                });
            })
            .catch((err) => {
                console.log(err);
                if (err.status == 404) {
                    // Has no Tasks yet.
                    this.setState({
                        hasParent: false
                    });
                }

                this.setState({
                    isLoadingTasks: false
                });
            })
    }

    onCheckTask(taskIndex, newStatus) {
       let newTaskItems = [
            ...this.state.taskItems
        ];
        newTaskItems[taskIndex] = {
            ...newTaskItems[taskIndex],
            [status]: newStatus
        };

        this.setState({
            taskItems: newTaskItems
        });

        const newTaskItem = newTaskItems[taskIndex];
        const updateTaskBody = {
            url: `https://api.azuqua.com/flo/bc20c39dd90c59ca6b0fed8b34debe54/invoke`, // FLO Router
            cors: true,
            type: 'post',
            dataType: 'json',
            data: {
                action: 'update',
                title: newTaskItem.title,
                status: newTaskItem.status,
                taskId: newTaskItem.id,
            }
        };
        this.props.client.request(updateTaskBody);
    }

    onUpdateTaskTitle(taskIndex, newTaskTitle) {
       let newTaskItems = [
            ...this.state.taskItems
        ];
        newTaskItems[taskIndex] = {
            ...newTaskItems[taskIndex],
            [title]: newTaskTitle
        };

        this.setState({
            taskItems: newTaskItems
        });

        const newTaskItem = newTaskItems[taskIndex];
        const updateTaskBody = {
            url: `https://api.azuqua.com/flo/bc20c39dd90c59ca6b0fed8b34debe54/invoke`, // FLO Router
            cors: true,
            type: 'post',
            dataType: 'json',
            data: {
                action: 'update',
                title: newTaskItem.title,
                status: newTaskItem.status,
                taskId: newTaskItem.id,
            }
        };
        this.props.client.request(updateTaskBody);
    }

    onCreateTask(key, newTaskTitle) {
       let newTaskItems = [
            ...this.state.taskItems
        ];
        newTaskItems[taskIndex] = {
            ...newTaskItems[taskIndex],
            [key]: value
        };

        this.setState({
            taskItems: newTaskItems
        });

        const newTaskItem = newTaskItems[taskIndex];
        const addBelowId = _.get(newTaskItems, `[${taskIndex - 1}].id`, '');

        const createTaskBody = {
           url: `https://api.azuqua.com/flo/bc20c39dd90c59ca6b0fed8b34debe54/invoke`, // FLO Router
           cors: true,
           type: 'post',
           dataType: 'json',
           data: {
            action: 'create',
            title: newTaskItem.title,
            parentId: this.state.parentId,
            addbelowId: addBelowId,
            ticketId: _.get(this.props, 'ticketData.id'),
            ticketUrl: this.state.ticketUrl
           }
        };
        this.props.client.request(createTaskBody)
            .then((result) => {
                console.log(result);
                // This will return something like { output: { "Task ID": <new_task_id>, "URL": <new_task_url>, "Parent ID": <new_task_parent_id> } }
                // go ahead and setState for parent ID (If we create the first task for an item, it will create a parent task as well)
                // this FLO will always return the Parent ID, even if we already know it (and passed it in).
            });
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
                                taskTitle={taskItemData.title}
                                taskId={taskItemData.id}
                                isChecked={(taskItemData.status == 'completed')}
                                onCheckTask={this.onCheckTask}
                                onUpdateTaskTitle={this.onUpdateTaskTitle}
                            />
                        )
                    })
                }

                <TaskItem
                    isNewTask={true}
                    key={nextTaskItemKey}
                    taskTitle=""
                    taskId={null}
                    isChecked={false}
                    onCheckTask={this.onCheckTask}
                    onUpdateTaskTitle={this.onUpdateTaskTitle}
                    onCreateTask={this.onCreateTask}
                />
            </div>
        );
    }
};

class TaskItem extends React.Component {

    constructor(props, ctx) {
        super(props, ctx);

        this.state = {
            taskTitle: props.taskTitle
        }
    }

    handleTaskTitleUpdate(e) {
        this.setState({
            taskTitle: e.target.value
        });
    }

    updateTaskTitle(e) {
        const { key, isNewTask, onCreateTask, onUpdateTaskTitle } = this.props;
        const newTaskTitle = this.state.taskTitle;
        if (isNewTask) {
            onCreateTask(key, newTaskTitle);
        } else {
            onUpdateTaskTitle(key, newTaskTitle);
        }
    }

    toggleTaskCompleted() {
        const { isChecked, onCheckTask, key } = this.props;
        const newStatus = isChecked
            ? 'needsAction'
            : 'completed';
        onCheckTask(key, newStatus);
    }

    render() {
        const { className, key } = this.props;

        return (
            <div className="row">
                <div className={`col c-chk c-chk--nolabel ${className}`}>
                    <input className="c-chk__input" id={`chk-${key}`} type="checkbox" value={this.props.isChecked} onChange={this.toggleTaskCompleted.bind(this)} disabled={this.props.isNewTask}/>
                    <label className="c-chk__label" dir="ltr" for={`chk-${key}`} onChange={this.toggleTaskCompleted.bind(this)} disabled={this.props.isNewTask}></label>
                    <input
                        className="task-text"
                        value={this.state.taskTitle}
                        onChange={this.handleTaskTitleUpdate.bind(this)}
                        onBlur={this.updateTaskTitle.bind(this)}   // To make things easier, only update when the user looses focus of the input  
                    />
                </div>
            </div>
        );
    }
}
