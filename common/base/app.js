(function(){

    'use strict';
    angular.module('ones', [
            'ngCookies',
            'ngResource',
            'ngSanitize',
            'ngRoute',
            'ngGrid',
            'ngAnimate',
            'mgcrea.ngStrap',
            'localytics.directives',
            'ui.utils',

            'angularFileUpload',

            "ones.pluginsModule",

            '[ones.requirements.placeholder]',

            'ones.common',
            'ones.common.models',
            'ones.common.resources',
            'ones.configModule',
            'ones.commonView' //需要先加载模块，让模块路由优先匹配
        ])
        /**
         * $http interceptor.
         * On 401 response – it stores the request and broadcasts 'event:loginRequired'.
         */
        .config(["$httpProvider", function($httpProvider) {
            var interceptor = ['$rootScope', '$q', function(scope, $q) {
                function success(response) {
                    if (parseInt(response.data.error) > 0) {
                        scope.$broadcast('event:serverError', response.data.msg);
                        return $q.reject(response);
                    } else {
                        return response;
                    }
                }
                function error(response) {
                    var status = response.status;
                    var deferred = $q.defer();
                    if (401 === status) {
                        scope.$broadcast('event:loginRequired', response.data);
                        return deferred.promise;
                    } else if (403 === status) {
                        scope.$broadcast('event:permissionDenied', response.data);
                    } else if (500 === status) {
                        scope.$broadcast('event:serverError', response.data);
                    }
                    return $q.reject(response);
                }

                return function(promise) {
                    return promise.then(success, error);
                };
            }];

            var reqInterceptor = ['$q', '$cacheFactory', '$timeout', '$rootScope', function ($q, $cacheFactory, $timeout, $rootScope) {
                return {
                    'request': function(config) {
                        $rootScope.dataQuering = true;
                        return config;
                    },

                    'response': function(response) {
                        $rootScope.dataQuering = false;
                        return response;
                    },

                    'responseError': function(rejection) {
                        $rootScope.dataQuering = false;
                        return $q.reject(rejection);
                    }
                };
            }];
            $httpProvider.interceptors.push(reqInterceptor);
            $httpProvider.responseInterceptors.push(interceptor);
        }])
        /**
         * Root Ctrl
         * */
        .controller('MainCtl', ["$scope", "$rootScope", "$location", "$http", "ones.config", "ComView",
            function($scope, $rootScope, $location, $http, conf, ComView) {

                setTimeout(function(){
                    $("#initCover").fadeOut(function(){
                        $("html").css({
                            height: "auto",
                            overflow: "scroll"
                        });
                    });
                }, 2000);

                //有需要的APP未能加载
                if(ones.unfoundApp) {
                    ComView.alert(
                        sprintf($rootScope.i18n.lang.messages.unfoundApp, ones.unfoundApp.join()),
                        "danger",
                        "!",
                        false);
                    $scope.unfoundApp = ones.unfoundApp;
                }

                $scope.onesConf = conf;
                $scope.BSU = conf.BSU;
                $scope.BSURoot = conf.BSURoot;
                if(!$scope.BSURoot) {
                    var tmp = conf.BSU.split("/").slice(0, -2);
                    $scope.BSURoot = tmp.join("/");
                }

                $scope.$watch(function() {
                    return $location.path();
                }, function() {
                    $scope.currentURI = encodeURI(encodeURIComponent($location.$$url));
                });

                //监听全局事件
                $scope.$on("event:loginRequired", function() {
                    window.location.href = 'index.html';
                });

                $scope.$on("event:permissionDenied", function(evt, msg) {
                    msg = ComView.toLang(msg || "permissionDenied", "messages");
                    ComView.alert(msg, "danger");
                });

                $scope.$on("event:serverError", function(evt, msg) {
                    msg = ComView.toLang(msg || "serverError", "messages");
                    ComView.alert(msg, "danger");
                });

                //屏蔽默认快捷键
                $scope.removeDefaultKey = function() {

                };

                $scope.isAppLoaded = function(app) {
                    return isAppLoaded(app);
                }

                $scope.isPrimaryApp = function(app) {
                    return ['dashboard','department', 'services'].indexOf(app) >=0 ? true : false;
                }

                /**
                 * 监控路由变化
                 * */
                var lastPage = []; //最后一页
                $scope.$watch(function() {
                    return $location.path();
                }, function() {
                    doWhenLocationChanged();

                    lastPage[0] = lastPage[1];
                    lastPage[1] = $location.path();

                    localStorage.lastPage = angular.toJson(lastPage);
                });

                function doWhenLocationChanged() {
                    /**
                     * 设置当前页面信息
                     * 两种URL模式： 普通模式 app/module/action
                     *             URL友好模式 app/action(list|add|edit)/module
                     * */
                    var actionList = ['list', 'listAll', 'export', 'add', 'edit', 'addChild', 'viewChild', 'viewDetail', 'print'];
                    var fullPath, app, module, action;
                    fullPath = $location.path().split("/").slice(1, 4);
                    if (!fullPath[1]) {
                        return;
                    }
                    app = fullPath[0];
                    fullPath[1] = fullPath[1].replace(/Bill/ig, ''); //将addBill, editBill转换为普通add,edit
                    //友好模式
                    if (actionList.indexOf(fullPath[1]) >= 0) {
                        module = fullPath[2].ucfirst();
                        action = fullPath[1];
                    } else {
                        module = fullPath[1];
                        action = fullPath[2];
                    }

                    app = app ? app : "HOME";
                    module = module ? module : "Index";
                    action = action && isNaN(parseInt(action)) ? action : "list";
//                        console.log(module);
                    $scope.currentPage = {
                        lang: {}
                    };
                    var urlmap = $rootScope.i18n.urlMap;
                    if (urlmap[app]) {
                        $scope.currentPage.lang.app = urlmap[app].name;
                        if (urlmap[app].modules[module]) {
                            $scope.currentPage.lang.module = urlmap[app].modules[module].name;
                            if (urlmap[app].modules[module].actions[action]) {
                                $scope.currentPage.lang.action = urlmap[app].modules[module].actions[action] instanceof Array
                                    ? urlmap[app].modules[module].actions[action][0]
                                    : urlmap[app].modules[module].actions[action];
                                $scope.currentPage.lang.actionDesc = urlmap[app].modules[module].actions[action] instanceof Array
                                    ? urlmap[app].modules[module].actions[action][1] : "";
                            }
                            if (!$scope.currentPage.lang.action) {
                                $scope.currentPage.lang.action = urlmap[app].modules[module].name;
                                $scope.currentPage.lang.actionDesc = $rootScope.i18n.lang.actions[action];
                            }
                        }
                    }

                    /**
                     * 设定当前APP信息
                     * current location info
                     * */
                    $scope.currentPage.app = app;
                    $scope.currentPage.action = action;
                    $scope.currentPage.module = module;
                    $rootScope.currentPage = $scope.currentPage;
                }

                doWhenLocationChanged();


                /**
                 * 获取页面基本信息
                 * @return {
                 *  user: {},
                 *  navs: {}
                 * }
                 * */
                $http.get(conf.BSU + "home/index.json").success(function(data) {
                    $scope.$broadcast("initDataLoaded", data);
                });

                $scope.$on("initDataLoaded", function(event, data) {
                    $scope.userInfo = data.user;
                    $scope.authedNodes = data.authed;
                });

            }])
    ;
})();
