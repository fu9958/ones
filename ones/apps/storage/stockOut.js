(function(window, angular, ones) {
    angular.module('ones.app.storage.stockOut', [])
        .service('Storage.StockOutAPI', [
            'ones.dataApiFactory',
            function(dataAPI) {
                this.resource = dataAPI.getResourceInstance({
                    uri: 'storage/stockOut'
                });

                this.config = {
                    app: 'storage',
                    module: 'stockOut',
                    table: 'stock_out',
                    is_bill: true,
                    detailable: true,
                    workflow: 'storage.stockOut',
                    bill_row_model: 'Storage.StockOutDetailAPI',
                    fields: {
                        bill_no: {
                            search_able: true
                        },
                        subject: {
                            search_able: true
                        },
                        user_id: {
                            label: _('common.Creator'),
                            cell_filter: 'to_user_fullname'
                        },
                        created: {
                            widget: 'datetime',
                            value: 'CURRENT_TIMESTAMP'
                        },
                        quantity: {
                            get_display: function(value, item) {
                                return value ? accounting.formatNumber(Number(value), ones.system_preference.decimal_scale) : value;
                            }
                        },
                        workflow_node_status_label: {
                            label: _('common.Status'),
                            addable: false,
                            editable: false,
                            data_source: [
                                {value: 0, label: _('storage.STOCK_OUT_STATUS_NEW')},
                                {value: 1, label: _('storage.STOCK_OUT_STATUS_SAVED')},
                                {value: 2, label: _('storage.STOCK_OUT_STATUS_PART')},
                                {value: 3, label: _('storage.STOCK_OUT_STATUS_COMPLETE')}
                            ],
                            map: 'status'
                        }
                    },
                    list_display: [
                        'bill_no',
                        'subject',
                        'source_model',
                        'quantity',
                        'created',
                        'workflow_node_status_label',
                        'user_id'
                    ],
                    bill_meta_required: [
                        'subject', 'created'
                    ],
                    filters: {
                        workflow_node_status_label: {
                            type: 'link'
                        }
                    }
                };

            }
        ])

        .service('Storage.StockOutDetailAPI', [
            'ones.dataApiFactory',
            'Product.ProductAPI',
            '$q',
            function(dataAPI, product, $q) {

                this.resource = dataAPI.getResourceInstance({
                    uri: 'storage/stockOutDetail'
                });

                this.config = {
                    app: 'storage',
                    module: 'stockOutDetail',
                    table: 'stock_out_detail',

                    fields: {
                        product_id: {
                            label: _('product.Product')
                            , widget: 'select3'
                            , data_source: 'Product.ProductAPI'
                            , auto_query: false
                            , get_display: function() {
                                return false;
                            }
                        }
                        , quantity: {
                            label: _('common.Quantity')
                            , widget: 'number'
                            , get_display: function(value, item) {
                                return to_decimal_display(value);
                            }
                            // 单元格后置计量单位
                            , get_bill_cell_after: function(value, item) {
                                return to_product_measure_unit(product, $q, item);
                            },
                            editable_required: 'product_id'
                        }
                        , stock_quantity: {
                            widget: 'static',
                            label: _('storage.Stock Quantity'),
                            width: 180,
                            get_display: function(value, item) {
                                return to_decimal_display(value);
                            },
                            get_bill_cell_after: function(value, item) {
                                return to_product_measure_unit(product, $q, item);
                            },
                            editable: false
                        }
                        , already_out: {
                            label: _('storage.Already out quantity'),
                            width: 180,
                            get_display: function(value, item) {
                                return to_decimal_display(value);
                            },
                            get_bill_cell_after: function(value, item) {
                                return to_product_measure_unit(product, $q, item);
                            }
                        }
                        , storage_id: {
                            label: _('storage.Storage')
                            , widget: 'select3'
                            , batch_select: true
                            , data_source: 'Storage.StorageAPI'
                            , get_display: function() {
                                return false;
                            }
                            , auto_query: true
                            , editable_required: 'product_id'
                        }
                        , remark: {
                            label: _('common.Remark')
                            , blank: true
                            , editable_required: 'product_id'
                            , force_editable: true
                        }
                    },

                    bill_fields: [
                        'product_id'
                        ,'quantity'
                        ,'storage_id'
                        ,'stock_quantity'
                        ,'remark'
                    ],

                    bill_row_required: [
                        'product_id', 'quantity', 'storage_id'
                    ]
                };

            }
        ])

        .controller('StockOutBillEditCtrl', [
            '$scope',
            '$timeout',
            'Storage.StockOutAPI',
            'Storage.StockOutDetailAPI',
            'Product.ProductAPI',
            'Bpm.WorkflowAPI',
            'BillModule',
            '$routeParams',
            '$q',
            '$injector',
            'RootFrameService',
            function($scope, $timeout, stock_out_api, stock_out_detail_api, product_api, workflow_api, bill, $routeParams, $q, $injector, RootFrameService) {

                if(!$routeParams.id) {
                    $scope.bill_meta_data = {
                        created: new Date(moment().format()),
                        user_id: ones.user_info.id
                    };
                } else {
                    $scope.bill_meta_data = {};
                }

                if($routeParams.id) {
                    $scope.is_edit = true;
                }

                // 产品属性
                if(is_app_loaded('productAttribute')) {
                    $injector.get('ProductAttribute.ProductAttributeAPI').assign_attributes(stock_out_detail_api);
                }

                // bill基本配置
                $scope.bill_config = {
                    model: stock_out_api,
                    subject: _('storage.Stock Out Bill'),
                    bill_no: {
                        value: generate_bill_no('CK')
                    }
                };

                switch($routeParams.action) {
                    case "view":
                        $scope.is_view = true;
                        $scope.bill_meta_data.locked = true;
                        if(stock_out_detail_api.config.bill_fields.indexOf('already_out') < 0) {
                            stock_out_detail_api.config.fields.quantity.label = _('storage.Total Quantity');
                            stock_out_detail_api.config.bill_fields.splice(
                                stock_out_detail_api.config.bill_fields.indexOf('quantity')+1,
                                0,
                                'already_out'
                            );
                        }
                        stock_out_detail_api.config.bill_fields.splice(stock_out_detail_api.config.bill_fields.indexOf('this_time_out_quantity'), 1);
                        break;
                    case "confirm":
                        $scope.back_able             = true;
                        $scope.is_view               = true;
                        $scope.bill_meta_data.locked = true;
                        $scope.workflowing           = true;
                        $scope.is_confirm            = true;

                        if(stock_out_detail_api.config.bill_fields.indexOf('this_time_out_quantity') < 0) {
                            // 新增本次入库/已入库数量控件，及修改仓库控件可编辑
                            stock_out_detail_api.config.fields.this_time_out_quantity = {
                                label: _('storage.This time out quantity'),
                                width: 180,
                                widget: 'number',
                                force_editable: true,
                                value: 0,
                                get_display: function(value) {
                                    return to_decimal_display(value);
                                },
                                get_bill_cell_after: function(value, item) {
                                    return to_product_measure_unit(product_api, $q, item);
                                }
                            };

                            stock_out_detail_api.config.fields.storage_id.force_editable = true;
                            stock_out_detail_api.config.fields.quantity.label = _('storage.Total Quantity');
                            stock_out_detail_api.config.fields.quantity.width = 180;
                            stock_out_detail_api.config.bill_fields.splice(
                                stock_out_detail_api.config.bill_fields.indexOf('quantity')+1,
                                0,
                                'this_time_out_quantity'
                            );
                        }

                        if(stock_out_detail_api.config.bill_fields.indexOf('already_out') < 0) {
                            stock_out_detail_api.config.fields.quantity.label = _('storage.Total Quantity');
                            stock_out_detail_api.config.bill_fields.splice(
                                stock_out_detail_api.config.bill_fields.indexOf('quantity')+1,
                                0,
                                'already_out'
                            );
                        }


                        // 确认出库提交方法
                        $scope.do_confirm = function() {
                            var post_data = bill.format_bill_data();
                            var rows = [];
                            angular.forEach(post_data.rows, function(item) {
                                if(!item.id || !item.storage_id || !item.this_time_out_quantity || !item.product_unique_id) {
                                    return;
                                }
                                rows.push(item);
                            });

                            if(!rows) {
                                RootFrameService.alert({
                                    type: 'danger',
                                    content: _('storage.Please fill this time in quantity')
                                });
                            }

                            workflow_api.post($routeParams.node_id, post_data.meta.id, {rows: rows});
                        };

                        break;
                }

                // 日期输入
                $scope.date_config = {
                    field: 'created',
                    widget: 'datetime',
                    'ng-model': 'bill_meta_data.created',
                    group_tpl: '<div class="input-group"><span class="input-group-addon">%(label)s</span>%(input)s</div>'
                };

                // 工作流选择
                $scope.workflow_config = {
                    label: _('bpm.Workflow'),
                    field: 'workflow_id',
                    widget: 'select',
                    'ng-model': 'bill_meta_data.workflow_id',
                    data_source: 'Bpm.WorkflowAPI',
                    data_source_query_param: {
                        _mf: 'module',
                        _mv: 'storage.stockOut'
                    },
                    group_tpl: '<div class="input-group"><span class="input-group-addon">%(label)s</span>%(input)s</div>'
                };
            }
        ])
    ;
})(window, window.angular, window.ones);