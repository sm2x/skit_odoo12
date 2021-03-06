odoo.define('skit_pos_restaurant.kitchen_view', function (require) {
"use strict";
var PosBaseWidget = require('point_of_sale.BaseWidget');
var chrome = require('point_of_sale.chrome');
var gui = require('point_of_sale.gui');
var models = require('point_of_sale.models');
var screens = require('point_of_sale.screens');
var PopupWidget = require('point_of_sale.popups');
var core = require('web.core');
var rpc = require('web.rpc');

var QWeb = core.qweb;
var _t = core._t;

var zoomLevel = 1;


var PaymenPopuptWidget = PopupWidget.extend({
	 template: 'PaymenPopuptWidget', 
		    events: _.extend({}, PopupWidget.prototype.events, {
		        'click .button.ok': 'click_ok',
			}),
		    click_ok: function(){
		    	var self = this;
	    		self.gui.close_popup();
		    },

});
gui.define_popup({name:'paymentpopupwidget', widget: PaymenPopuptWidget});


/** Payment -  POP-UP widget **/
var OrderPaymentWidget = PopupWidget.extend({
	 template: 'OrderPaymentWidget', 
		    events: _.extend({}, PopupWidget.prototype.events, {
		    	'click .button.payment-cancel':  'click_cancel',
		        'click .button.payment-ok': 'click_ok',
			}),
			click_cancel: function(){
				var self = this;
				self.gui.close_popup();
		    },

		    click_ok: function(){
		    	var self = this;
		    	var payment_amount = $("#payment_amount").val();
		    	var journal_id = $("#journal_id").val();
		    	var invoice_id = $("#invoice_id").text();
		    	var order_id = $("#order_id").text();
	    		self.gui.close_popup();
	    		this._rpc({
					model: 'sale.order',
					method: 'create_payment',
					args: [0, journal_id, invoice_id, order_id],
				}).then(function(result){ 
					self.pos.gui.show_popup('paymentpopupwidget', {
		                'title': _t('Success'),	
		            });
				});
		    },

});
gui.define_popup({name:'popuppaymentwidget', widget: OrderPaymentWidget});

/** Sales order screen widget **/
var SOOrderScreenWidget = screens.ScreenWidget.extend({
    template: 'SOOrderScreenWidget',

    init: function(parent, options) {
        this._super(parent, options);
        this.editing = false;
        this.sorder_cache = new screens.DomCache();
    },	
    
    auto_back: true,
    
    hide: function(){
        this._super();
        if (this.editing) {
            this.toggle_editing();
        }
        
    },
   
    show: function(){
        var self = this;
        this._super();
        this.chrome.widget.order_selector.hide();
        this.renderElement();
        
        var orders = this.pos.db.get_sorder_sorted(1000);
        this.render_sorder(orders);
        
        this.$('#zoom_in').click(function(e){
        	self.updateZoom(1);
        });
        
        this.$('#zoom_out').click(function(e){
        	self.updateZoom(-1);
        });
        this.$('#order_status').on('change', function() {
        	
        	  var orders = self.pos.db.get_sorder_sorted(1000);
        	  
              var filtered_orders = orders;
              var open_orders = [];
              var confirm_orders = [];
              var prepare_orders = [];
              var pickup_orders = [];
              if(this.value != "all"){
            	  self.$('.arrows').addClass("wet_display_none");
            	  var opencontents = self.$el[0].querySelector('.all_checkout_orders .open_orders');
            	  opencontents.innerHTML = "";
            	  var confirmcontents = self.$el[0].querySelector('.all_checkout_orders .confirm_orders');
            	  confirmcontents.innerHTML = "";
            	  var preparecontents = self.$el[0].querySelector('.all_checkout_orders .prepare_orders');
            	  preparecontents.innerHTML = "";
            	  var readycontents = self.$el[0].querySelector('.all_checkout_orders .ready_orders');
            	  readycontents.innerHTML = "";  
            	  
            	  var firstcontents = self.$el[0].querySelector('.checkout_orders .first_orders');
	        	  firstcontents.innerHTML = "";
          	      var secondcontents = self.$el[0].querySelector('.checkout_orders .second_orders');
          	      secondcontents.innerHTML = "";
          	      var thirdcontents = self.$el[0].querySelector('.checkout_orders .third_orders');
          	      thirdcontents.innerHTML = "";
          	      var fourthcontents = self.$el[0].querySelector('.checkout_orders .fourth_orders');
          	      fourthcontents.innerHTML = "";
            	  
            	  var ostate = this.value;
            	  if(this.value == 'open'){
            		  filtered_orders = $.grep(orders, function(v) {
                          return v.state === "draft" || v.state === "sent";
                      });
            	  }else{
            		  filtered_orders = $.grep(orders, function(v) {
                          return v.state === ostate;
                      });
            	  }
            	  var j = 0;
            	  for(var i = 0, len = Math.min(filtered_orders.length,1000); i < len; i++){
                      var order    = filtered_orders[i];
                      var sorderline = self.sorder_cache.get_node(order.id);
                     
                      if(j == 0){
                    	  var contents = self.$el[0].querySelector('.checkout_orders .first_orders');
                      }
                      if(j == 1){
                    	  var contents = self.$el[0].querySelector('.checkout_orders .second_orders');
                      }
                      if(j == 2){
                    	  var contents = self.$el[0].querySelector('.checkout_orders .third_orders');
                      }
                      if(j == 3){
                    	  var contents = self.$el[0].querySelector('.checkout_orders .fourth_orders');
                      }
                      if(!sorderline){
                      	var orderlines = [];
                      	if(self.pos.db.get_orderline_by_order(filtered_orders[i].id) != undefined){
                      		orderlines = self.pos.db.get_orderline_by_order(filtered_orders[i].id);
                      	}
                          var sorderline_html = QWeb.render('ShopCartOrders',{widget: self, sorder:filtered_orders[i], sorderlines:orderlines, slevel:zoomLevel});
                          var sorderline = document.createElement('div');
                          sorderline.innerHTML = sorderline_html;
                          sorderline = sorderline.childNodes[1];
                          self.sorder_cache.cache_node(order.id,sorderline);
                          var state_icon = sorderline.querySelector('.order_btn');
                          if(state_icon){
                          	state_icon.addEventListener('click', (function(e) {
                          		
                              	var order_id = e.target.dataset.item;
                              	var order_state = ($("#"+order_id).text()).trim();
                              	self.update_order_state(order_id, order_state);
                              	
                              }.bind(self)));
                          }
                          var del_icon = sorderline.querySelector('.del_btn');
                          if(del_icon){
                        	  del_icon.addEventListener('click', (function(e) {
                          		
                              	var order_id = e.target.dataset.item;
                              	self.delete_order(order_id);
                              	
                              }.bind(self)));
                          }
                          
                      }
                      
                      if(j == 3){
                    	  j = 0;
                      }else{
                    	  j++;
                      }
                      
                      contents.prepend(sorderline);
                  }
            	  
              }else{
            	  self.$('.arrows').removeClass("wet_display_none");
            	  var opencontents = self.$el[0].querySelector('.all_checkout_orders .open_orders');
            	  opencontents.innerHTML = "";
            	  var confirmcontents = self.$el[0].querySelector('.all_checkout_orders .confirm_orders');
            	  confirmcontents.innerHTML = "";
            	  var preparecontents = self.$el[0].querySelector('.all_checkout_orders .prepare_orders');
            	  preparecontents.innerHTML = "";
            	  var readycontents = self.$el[0].querySelector('.all_checkout_orders .ready_orders');
            	  readycontents.innerHTML = "";  
            	  
            	    var firstcontents = self.$el[0].querySelector('.checkout_orders .first_orders');
  	        	    firstcontents.innerHTML = "";
            	    var secondcontents = self.$el[0].querySelector('.checkout_orders .second_orders');
            	    secondcontents.innerHTML = "";
            	    var thirdcontents = self.$el[0].querySelector('.checkout_orders .third_orders');
            	    thirdcontents.innerHTML = "";
            	    var fourthcontents = self.$el[0].querySelector('.checkout_orders .fourth_orders');
            	    fourthcontents.innerHTML = "";
            	    
	  	        	open_orders = $.grep(filtered_orders, function(v) {
	  	                return v.state === "draft" || v.state === "sent";
	  	            });
	  	        	confirm_orders = $.grep(filtered_orders, function(v) {
	  	                return v.state === "sale";
	  	            });
	  	        	prepare_orders = $.grep(filtered_orders, function(v) {
	  	                return v.state === "preparing";
	  	            });
	  	        	pickup_orders = $.grep(filtered_orders, function(v) {
	  	                return v.state === "ready";
	  	            });
	  	        	var contents = self.$el[0].querySelector('.all_checkout_orders .open_orders'); 
	  	        	for(var i = 0, len = Math.min(open_orders.length,1000); i < len; i++){
	  	                var order    = open_orders[i];
	  	                var sorderline = self.sorder_cache.get_node(order.id);
	  	               
	  	                if(!sorderline){
	  	                	var orderlines = [];
	  	                	if(self.pos.db.get_orderline_by_order(open_orders[i].id) != undefined){
	  	                		orderlines = self.pos.db.get_orderline_by_order(open_orders[i].id);
	  	                	}
	  	                    var sorderline_html = QWeb.render('ShopCartOrders',{widget: self, sorder:open_orders[i], sorderlines:orderlines, slevel:zoomLevel});
	  	                    var sorderline = document.createElement('div');
	  	                    sorderline.innerHTML = sorderline_html;
	  	                    sorderline = sorderline.childNodes[1];
	  	                  self.sorder_cache.cache_node(order.id,sorderline);
	  	                    var state_icon = sorderline.querySelector('.order_btn');
	  	                    if(state_icon){
	  	                    	state_icon.addEventListener('click', (function(e) {
	  	                    		
	  	                        	var order_id = e.target.dataset.item;
	  	                        	var order_state = ($("#"+order_id).text()).trim();
	  	                        	self.update_order_state(order_id, order_state);
	  	                        	
	  	                        }.bind(self)));
	  	                    }
	  	                    var del_icon = sorderline.querySelector('.del_btn');
	  	                    if(del_icon){
	  	                    	del_icon.addEventListener('click', (function(e) {
	  	                    		
	  	                        	var order_id = e.target.dataset.item;
	  	                        	self.delete_order(order_id);
	  	                        	
	  	                        }.bind(self)));
	  	                    }
	  	                  
	  	                }
	  	                
	  	                contents.prepend(sorderline);
	  	            }
	  	        	var contents = self.$el[0].querySelector('.all_checkout_orders .confirm_orders'); 
	  	        	for(var i = 0, len = Math.min(confirm_orders.length,1000); i < len; i++){
	  	                var order    = confirm_orders[i];
	  	                var sorderline = self.sorder_cache.get_node(order.id);
	  	               
	  	                if(!sorderline){
	  	                	var orderlines = [];
	  	                	if(self.pos.db.get_orderline_by_order(confirm_orders[i].id) != undefined){
	  	                		orderlines = self.pos.db.get_orderline_by_order(confirm_orders[i].id);
	  	                	}
	  	                    var sorderline_html = QWeb.render('ShopCartOrders',{widget: this, sorder:confirm_orders[i], sorderlines:orderlines, slevel:zoomLevel});
	  	                    var sorderline = document.createElement('div');
	  	                    sorderline.innerHTML = sorderline_html;
	  	                    sorderline = sorderline.childNodes[1];
	  	                    self.sorder_cache.cache_node(order.id,sorderline);
	  	                    var state_icon = sorderline.querySelector('.order_btn');
	  	                    if(state_icon){
	  	                    	state_icon.addEventListener('click', (function(e) {
	  	                    		
	  	                        	var order_id = e.target.dataset.item;
	  	                        	var order_state = ($("#"+order_id).text()).trim();
	  	                        	self.update_order_state(order_id, order_state);
	  	                        	
	  	                        }.bind(self)));
	  	                    }
	  	                    var del_icon = sorderline.querySelector('.del_btn');
	  	                    if(del_icon){
	  	                    	del_icon.addEventListener('click', (function(e) {
	  	                    		
	  	                        	var order_id = e.target.dataset.item;
	  	                        	self.delete_order(order_id);
	  	                        	
	  	                        }.bind(self)));
	  	                    }
	  	                  
	  	                }
	  	                
	  	                contents.prepend(sorderline);
	  	            }
	  	        	var contents = self.$el[0].querySelector('.all_checkout_orders .prepare_orders'); 
	  	        	for(var i = 0, len = Math.min(prepare_orders.length,1000); i < len; i++){
	  	                var order    = prepare_orders[i];
	  	                var sorderline = self.sorder_cache.get_node(order.id);
	  	               
	  	                if(!sorderline){
	  	                	var orderlines = [];
	  	                	if(self.pos.db.get_orderline_by_order(prepare_orders[i].id) != undefined){
	  	                		orderlines = self.pos.db.get_orderline_by_order(prepare_orders[i].id);
	  	                	}
	  	                    var sorderline_html = QWeb.render('ShopCartOrders',{widget: this, sorder:prepare_orders[i], sorderlines:orderlines, slevel:zoomLevel});
	  	                    var sorderline = document.createElement('div');
	  	                    sorderline.innerHTML = sorderline_html;
	  	                    sorderline = sorderline.childNodes[1];
	  	                    self.sorder_cache.cache_node(order.id,sorderline);
	  	                    var state_icon = sorderline.querySelector('.order_btn');
	  	                    if(state_icon){
	  	                    	state_icon.addEventListener('click', (function(e) {
	  	                    		
	  	                        	var order_id = e.target.dataset.item;
	  	                        	var order_state = ($("#"+order_id).text()).trim();
	  	                        	self.update_order_state(order_id, order_state);
	  	                        	
	  	                        }.bind(self)));
	  	                    }
	  	                    var del_icon = sorderline.querySelector('.del_btn');
	  	                    if(del_icon){
	  	                    	del_icon.addEventListener('click', (function(e) {
	  	                    		
	  	                        	var order_id = e.target.dataset.item;
	  	                        	self.delete_order(order_id);
	  	                        	
	  	                        }.bind(self)));
	  	                    }
	  	                  
	  	                }
	  	                
	  	                contents.prepend(sorderline);
	  	            }
	  	        	var contents = self.$el[0].querySelector('.all_checkout_orders .ready_orders'); 
	  	        	for(var i = 0, len = Math.min(pickup_orders.length,1000); i < len; i++){
	  	                var order    = pickup_orders[i];
	  	                var sorderline = self.sorder_cache.get_node(order.id);
	  	               
	  	                if(!sorderline){
	  	                	var orderlines = [];
	  	                	if(self.pos.db.get_orderline_by_order(pickup_orders[i].id) != undefined){
	  	                		orderlines = self.pos.db.get_orderline_by_order(pickup_orders[i].id);
	  	                	}
	  	                    var sorderline_html = QWeb.render('ShopCartOrders',{widget: this, sorder:pickup_orders[i], sorderlines:orderlines, slevel:zoomLevel});
	  	                    var sorderline = document.createElement('div');
	  	                    sorderline.innerHTML = sorderline_html;
	  	                    sorderline = sorderline.childNodes[1];
	  	                  self.sorder_cache.cache_node(order.id,sorderline);
	  	                    var state_icon = sorderline.querySelector('.order_btn');
	  	                    if(state_icon){
	  	                    	state_icon.addEventListener('click', (function(e) {
	  	                    		
	  	                        	var order_id = e.target.dataset.item;
	  	                        	var order_state = ($("#"+order_id).text()).trim();
	  	                        	self.update_order_state(order_id, order_state);
	  	                        	
	  	                        }.bind(self)));
	  	                    }
	  	                    var del_icon = sorderline.querySelector('.del_btn');
	  	                    if(del_icon){
	  	                    	del_icon.addEventListener('click', (function(e) {
	  	                    		
	  	                        	var order_id = e.target.dataset.item;
	  	                        	self.delete_order(order_id);
	  	                        	
	  	                        }.bind(self)));
	  	                    }
	  	                  
	  	                }
	  	                
	  	                contents.prepend(sorderline);
	  	            }
              }
              
              
        });
       
    },
    updateZoom: function(zoom){
    	var mutelevel = zoomLevel + zoom;
    	if(mutelevel > 0 && mutelevel <= 4){
	    	zoomLevel += zoom;
	    	if(zoomLevel == 1){
	    		$('.open_orders, .confirm_orders, .prepare_orders, .ready_orders').removeClass('pos_zoom1');
	    		$('.first_orders, .second_orders, .third_orders, .fourth_orders').removeClass('pos_zoom1');
	        	$('.pos-cart-header-li').removeClass('pos_header_zoom1');
	        	$('.cart_list_span').removeClass('pos_list_zoom1');
	        	$('.w41').removeClass('wd_zoom1');
	    	}
	    	if(zoomLevel == 2){
	    		$('.open_orders, .confirm_orders, .prepare_orders, .ready_orders').removeClass('pos_zoom2');
	    		$('.first_orders, .second_orders, .third_orders, .fourth_orders').removeClass('pos_zoom2');
	        	$('.pos-cart-header-li').removeClass('pos_header_zoom2');
	        	$('.cart_list_span').removeClass('pos_list_zoom2');
	        	$('.w41').removeClass('wd_zoom2');
	        	$('.open_orders, .confirm_orders, .prepare_orders, .ready_orders').addClass('pos_zoom1');
	        	$('.first_orders, .second_orders, .third_orders, .fourth_orders').addClass('pos_zoom1');
	        	$('.pos-cart-header-li').addClass('pos_header_zoom1');
	        	$('.cart_list_span').addClass('pos_list_zoom1');
	        	$('.w41').addClass('wd_zoom1');
	    	}
	    	if(zoomLevel == 3){
	    		$('.open_orders, .confirm_orders, .prepare_orders, .ready_orders').removeClass('pos_zoom1');
	    		$('.first_orders, .second_orders, .third_orders, .fourth_orders').removeClass('pos_zoom1');
	        	$('.pos-cart-header-li').removeClass('pos_header_zoom1');
	        	$('.cart_list_span').removeClass('pos_list_zoom1');
	        	$('.w41').removeClass('wd_zoom1');
	        	$('.open_orders, .confirm_orders, .prepare_orders, .ready_orders').removeClass('pos_zoom2');
	        	$('.first_orders, .second_orders, .third_orders, .fourth_orders').removeClass('pos_zoom2');
	        	$('.pos-cart-header-li').removeClass('pos_header_zoom2');
	        	$('.cart_list_span').removeClass('pos_list_zoom2');
	        	$('.w41').removeClass('wd_zoom2');
	        	$('.open_orders, .confirm_orders, .prepare_orders, .ready_orders').removeClass('pos_zoom3');
	        	$('.first_orders, .second_orders, .third_orders, .fourth_orders').removeClass('pos_zoom3');
	        	$('.pos-cart-header-li').removeClass('pos_header_zoom3');
	        	$('.cart_list_span').removeClass('pos_list_zoom3');
	        	$('.w41').removeClass('wd_zoom3');
	        	$('.open_orders, .confirm_orders, .prepare_orders, .ready_orders').addClass('pos_zoom2');
	        	$('.first_orders, .second_orders, .third_orders, .fourth_orders').addClass('pos_zoom2');
	        	$('.pos-cart-header-li').addClass('pos_header_zoom2');
	        	$('.cart_list_span').addClass('pos_list_zoom2');
	        	$('.w41').addClass('wd_zoom2');
	    	}
	    	if(zoomLevel == 4){
	    		$('.open_orders, .confirm_orders, .prepare_orders, .ready_orders').removeClass('pos_zoom1');
	    		$('.first_orders, .second_orders, .third_orders, .fourth_orders').removeClass('pos_zoom1');
	        	$('.pos-cart-header-li').removeClass('pos_header_zoom1');
	        	$('.cart_list_span').removeClass('pos_list_zoom1');
	        	$('.w41').removeClass('wd_zoom1');
	        	$('.open_orders, .confirm_orders, .prepare_orders, .ready_orders').removeClass('pos_zoom2');
	        	$('.first_orders, .second_orders, .third_orders, .fourth_orders').removeClass('pos_zoom2');
	        	$('.pos-cart-header-li').removeClass('pos_header_zoom2');
	        	$('.cart_list_span').removeClass('pos_list_zoom2');
	        	$('.w41').removeClass('wd_zoom2');
	        	$('.open_orders, .confirm_orders, .prepare_orders, .ready_orders').removeClass('pos_zoom3');
	        	$('.first_orders, .second_orders, .third_orders, .fourth_orders').removeClass('pos_zoom3');
	        	$('.pos-cart-header-li').removeClass('pos_header_zoom3');
	        	$('.cart_list_span').removeClass('pos_list_zoom3');
	        	$('.w41').removeClass('wd_zoom3');
	        	$('.open_orders, .confirm_orders, .prepare_orders, .ready_orders').addClass('pos_zoom3');
	        	$('.first_orders, .second_orders, .third_orders, .fourth_orders').addClass('pos_zoom3');
	        	$('.pos-cart-header-li').addClass('pos_header_zoom3');
	        	$('.cart_list_span').addClass('pos_list_zoom3');
	        	$('.w41').addClass('wd_zoom3');
	    	}
    	}
    	
    	//$('body').css({ zoom: zoomLevel, '-moz-transform': 'scale(' + zoomLevel + ')' });
    },
    
    update_order_state: function(order_id, order_state){
    	var self = this;
    	if(order_state == "Payment"){
    		this._rpc({
				model: 'sale.order',
				method: 'get_invoice_details',
				args: [0, order_id],
			}).then(function(result){ 
				self.pos.gui.show_popup('popuppaymentwidget', {
	                'title': _t('Payment'),
	                'journals':result,	
	            });
			});
    	}else{
	    	this._rpc({
				model: 'sale.order',
				method: 'change_order_state',
				args: [0, order_id, order_state],
			}).then(function(result){ 
				console.log("Order confirmed");
			});
    	}
    },
    
    delete_order: function(order_id){
    	var self = this;
    	this.gui.show_popup('confirm',{
			'title': _t('Warning'),
			'body': _t('Are you sure want to cancel this order?'),
			confirm: function(){
				self._rpc({
					model: 'sale.order',
					method: 'delete_order',
					args: [0, order_id],
				}).then(function(result){ 
					console.log("Order Deleted.");
				});
			},
		});
    },
    
    update_order_cache: function(order_ids) {
        var self = this;
        var order = {};
        _.each(order_ids, function(oid){
            order = self.pos.db.get_sorder_by_id(oid);
            if (!order) {
                return;
            }
            var sorderline_html = '';
            var sorderline = self.sorder_cache.get_node(order.id);
            if(sorderline){
            	var orderlines = self.pos.db.get_orderline_by_order(order.id);
                sorderline_html = QWeb.render('ShopCartOrders',{widget: self, sorder:order, sorderlines:orderlines, slevel:zoomLevel});
                sorderline = document.createElement('div');
                sorderline.innerHTML = sorderline_html;
                sorderline = sorderline.childNodes[1];
                self.sorder_cache.cache_node(order.id,sorderline);
                var state_icon = sorderline.querySelector('.order_btn');
                if(state_icon){
                	state_icon.addEventListener('click', (function() {
                		var order_id = state_icon.getAttribute('order_id');
                    	var order_state = ($("#"+order_id).text()).trim();
                    	self.update_order_state(order_id, order_state);
                    }.bind(this)));
                }
                var del_icon = sorderline.querySelector('.del_btn');
                if(del_icon){
                	del_icon.addEventListener('click', (function() {
                		var order_id = del_icon.getAttribute('order_id');
                    	self.delete_order(order_id);
                    }.bind(this)));
                }
            }
            
        });
    },
    update_sorder_screen: function(order_ids){
       
        this.render_sorder(this.pos.db.get_sorder_sorted(1000));
    },
    
    render_sorder: function(sorders){
    	/*var contents = this.$el[0].querySelector('.checkout_orders');
        contents.innerHTML = "";*/
        var state_value = $("#order_status option:selected").val();
        var orders = sorders;
        var open_orders = [];
        var confirm_orders = [];
        var prepare_orders = [];
        var pickup_orders = [];
        if(state_value != undefined && state_value != ""){
	        if(state_value == "all"){
	        	
	        	var opencontents = this.$el[0].querySelector('.all_checkout_orders .open_orders');
          	    opencontents.innerHTML = "";
          	    var confirmcontents = this.$el[0].querySelector('.all_checkout_orders .confirm_orders');
          	    confirmcontents.innerHTML = "";
          	    var preparecontents = this.$el[0].querySelector('.all_checkout_orders .prepare_orders');
          	    preparecontents.innerHTML = "";
          	    var readycontents = this.$el[0].querySelector('.all_checkout_orders .ready_orders');
          	    readycontents.innerHTML = "";

	        	var firstcontents = this.$el[0].querySelector('.checkout_orders .first_orders');
	        	firstcontents.innerHTML = "";
          	    var secondcontents = this.$el[0].querySelector('.checkout_orders .second_orders');
          	    secondcontents.innerHTML = "";
          	    var thirdcontents = this.$el[0].querySelector('.checkout_orders .third_orders');
          	    thirdcontents.innerHTML = "";
          	    var fourthcontents = this.$el[0].querySelector('.checkout_orders .fourth_orders');
          	    fourthcontents.innerHTML = "";
	        	
	        	open_orders = $.grep(sorders, function(v) {
	                return v.state === "draft" || v.state === "sent";
	            });
	        	confirm_orders = $.grep(sorders, function(v) {
	                return v.state === "sale";
	            });
	        	prepare_orders = $.grep(sorders, function(v) {
	                return v.state === "preparing";
	            });
	        	pickup_orders = $.grep(sorders, function(v) {
	                return v.state === "ready";
	            });
	        	var contents = this.$el[0].querySelector('.all_checkout_orders .open_orders'); 
	        	for(var i = 0, len = Math.min(open_orders.length,1000); i < len; i++){
	                var order    = open_orders[i];
	                var sorderline = this.sorder_cache.get_node(order.id);
	               
	                if(!sorderline){
	                	var orderlines = [];
	                	if(this.pos.db.get_orderline_by_order(open_orders[i].id) != undefined){
	                		orderlines = this.pos.db.get_orderline_by_order(open_orders[i].id);
	                	}
	                    var sorderline_html = QWeb.render('ShopCartOrders',{widget: this, sorder:open_orders[i], sorderlines:orderlines, slevel:zoomLevel});
	                    var sorderline = document.createElement('div');
	                    sorderline.innerHTML = sorderline_html;
	                    sorderline = sorderline.childNodes[1];
	                    this.sorder_cache.cache_node(order.id,sorderline);
	                    var state_icon = sorderline.querySelector('.order_btn');
	                    if(state_icon){
	                    	state_icon.addEventListener('click', (function(e) {
	                    		
	                        	var order_id = e.target.dataset.item;
	                        	var order_state = ($("#"+order_id).text()).trim();
	                        	this.update_order_state(order_id, order_state);
	                        	
	                        }.bind(this)));
	                    }
	                    var del_icon = sorderline.querySelector('.del_btn');
	                    if(del_icon){
	                    	del_icon.addEventListener('click', (function(e) {
	                    		
	                        	var order_id = e.target.dataset.item;
	                        	this.delete_order(order_id);
	                        	
	                        }.bind(this)));
	                    }
	                  
	                }
	                
	                contents.prepend(sorderline);
	            }
	        	var contents = this.$el[0].querySelector('.all_checkout_orders .confirm_orders'); 
	        	for(var i = 0, len = Math.min(confirm_orders.length,1000); i < len; i++){
	                var order    = confirm_orders[i];
	                var sorderline = this.sorder_cache.get_node(order.id);
	               
	                if(!sorderline){
	                	var orderlines = [];
	                	if(this.pos.db.get_orderline_by_order(confirm_orders[i].id) != undefined){
	                		orderlines = this.pos.db.get_orderline_by_order(confirm_orders[i].id);
	                	}
	                    var sorderline_html = QWeb.render('ShopCartOrders',{widget: this, sorder:confirm_orders[i], sorderlines:orderlines, slevel:zoomLevel});
	                    var sorderline = document.createElement('div');
	                    sorderline.innerHTML = sorderline_html;
	                    sorderline = sorderline.childNodes[1];
	                    this.sorder_cache.cache_node(order.id,sorderline);
	                    var state_icon = sorderline.querySelector('.order_btn');
	                    if(state_icon){
	                    	state_icon.addEventListener('click', (function(e) {
	                    		
	                        	var order_id = e.target.dataset.item;
	                        	var order_state = ($("#"+order_id).text()).trim();
	                        	this.update_order_state(order_id, order_state);
	                        	
	                        }.bind(this)));
	                    }
	                    var del_icon = sorderline.querySelector('.del_btn');
	                    if(del_icon){
	                    	del_icon.addEventListener('click', (function(e) {
	                    		
	                        	var order_id = e.target.dataset.item;
	                        	this.delete_order(order_id);
	                        	
	                        }.bind(this)));
	                    }
	                  
	                }
	                
	                contents.prepend(sorderline);
	            }
	        	var contents = this.$el[0].querySelector('.all_checkout_orders .prepare_orders'); 
	        	for(var i = 0, len = Math.min(prepare_orders.length,1000); i < len; i++){
	                var order    = prepare_orders[i];
	                var sorderline = this.sorder_cache.get_node(order.id);
	               
	                if(!sorderline){
	                	var orderlines = [];
	                	if(this.pos.db.get_orderline_by_order(prepare_orders[i].id) != undefined){
	                		orderlines = this.pos.db.get_orderline_by_order(prepare_orders[i].id);
	                	}
	                    var sorderline_html = QWeb.render('ShopCartOrders',{widget: this, sorder:prepare_orders[i], sorderlines:orderlines, slevel:zoomLevel});
	                    var sorderline = document.createElement('div');
	                    sorderline.innerHTML = sorderline_html;
	                    sorderline = sorderline.childNodes[1];
	                    this.sorder_cache.cache_node(order.id,sorderline);
	                    var state_icon = sorderline.querySelector('.order_btn');
	                    if(state_icon){
	                    	state_icon.addEventListener('click', (function(e) {
	                    		
	                        	var order_id = e.target.dataset.item;
	                        	var order_state = ($("#"+order_id).text()).trim();
	                        	this.update_order_state(order_id, order_state);
	                        	
	                        }.bind(this)));
	                    }
	                    var del_icon = sorderline.querySelector('.del_btn');
	                    if(del_icon){
	                    	del_icon.addEventListener('click', (function(e) {
	                    		
	                        	var order_id = e.target.dataset.item;
	                        	this.delete_order(order_id);
	                        	
	                        }.bind(this)));
	                    }
	                  
	                }
	                
	                contents.prepend(sorderline);
	            }
	        	var contents = this.$el[0].querySelector('.all_checkout_orders .ready_orders'); 
	        	for(var i = 0, len = Math.min(pickup_orders.length,1000); i < len; i++){
	                var order    = pickup_orders[i];
	                var sorderline = this.sorder_cache.get_node(order.id);
	               
	                if(!sorderline){
	                	var orderlines = [];
	                	if(this.pos.db.get_orderline_by_order(pickup_orders[i].id) != undefined){
	                		orderlines = this.pos.db.get_orderline_by_order(pickup_orders[i].id);
	                	}
	                    var sorderline_html = QWeb.render('ShopCartOrders',{widget: this, sorder:pickup_orders[i], sorderlines:orderlines, slevel:zoomLevel});
	                    var sorderline = document.createElement('div');
	                    sorderline.innerHTML = sorderline_html;
	                    sorderline = sorderline.childNodes[1];
	                    this.sorder_cache.cache_node(order.id,sorderline);
	                    var state_icon = sorderline.querySelector('.order_btn');
	                    if(state_icon){
	                    	state_icon.addEventListener('click', (function(e) {
	                    		
	                        	var order_id = e.target.dataset.item;
	                        	var order_state = ($("#"+order_id).text()).trim();
	                        	this.update_order_state(order_id, order_state);
	                        	
	                        }.bind(this)));
	                    }
	                    var del_icon = sorderline.querySelector('.del_btn');
	                    if(del_icon){
	                    	del_icon.addEventListener('click', (function(e) {
	                    		
	                        	var order_id = e.target.dataset.item;
	                        	this.delete_order(order_id);
	                        	
	                        }.bind(this)));
	                    }
	                  
	                }
	                
	                contents.prepend(sorderline);
	            }
	        }else{
	        	var firstcontents = this.$el[0].querySelector('.checkout_orders .first_orders');
	        	firstcontents.innerHTML = "";
          	    var secondcontents = this.$el[0].querySelector('.checkout_orders .second_orders');
          	    secondcontents.innerHTML = "";
          	    var thirdcontents = this.$el[0].querySelector('.checkout_orders .third_orders');
          	    thirdcontents.innerHTML = "";
          	    var fourthcontents = this.$el[0].querySelector('.checkout_orders .fourth_orders');
          	    fourthcontents.innerHTML = "";

	        	var opencontents = this.$el[0].querySelector('.all_checkout_orders .open_orders');
          	    opencontents.innerHTML = "";
          	    var confirmcontents = this.$el[0].querySelector('.all_checkout_orders .confirm_orders');
          	    confirmcontents.innerHTML = "";
          	    var preparecontents = this.$el[0].querySelector('.all_checkout_orders .prepare_orders');
          	    preparecontents.innerHTML = "";
          	    var readycontents = this.$el[0].querySelector('.all_checkout_orders .ready_orders');
          	    readycontents.innerHTML = "";
	        	if(state_value != undefined && state_value != ""){
	    	        if(state_value != "all"){
	    	      	  if(state_value == 'open'){
	    	      		orders = $.grep(sorders, function(v) {
	    	                    return v.state === "draft" || v.state === "sent";
	    	                });
	    	      	  }else{
	    	      		orders = $.grep(sorders, function(v) {
	    	                    return v.state === state_value;
	    	                });
	    	      	  }
	    	      	  
	    	        }
	            }
	        	var j = 0;
	            for(var i = 0, len = Math.min(orders.length,1000); i < len; i++){
	                var order    = orders[i];
	                var sorderline = this.sorder_cache.get_node(order.id);
	               
	                if(j == 0){
	                	  var contents = this.$el[0].querySelector('.checkout_orders .first_orders');
	                  }
	                  if(j == 1){
	                	  var contents = this.$el[0].querySelector('.checkout_orders .second_orders');
	                  }
	                  if(j == 2){
	                	  var contents = this.$el[0].querySelector('.checkout_orders .third_orders');
	                  }
	                  if(j == 3){
	                	  var contents = this.$el[0].querySelector('.checkout_orders .fourth_orders');
	                  }
	                if(!sorderline){
	                	var orderlines = [];
	                	if(this.pos.db.get_orderline_by_order(orders[i].id) != undefined){
	                		orderlines = this.pos.db.get_orderline_by_order(orders[i].id);
	                	}
	                    var sorderline_html = QWeb.render('ShopCartOrders',{widget: this, sorder:orders[i], sorderlines:orderlines, slevel:zoomLevel});
	                    var sorderline = document.createElement('div');
	                    sorderline.innerHTML = sorderline_html;
	                    sorderline = sorderline.childNodes[1];
	                    this.sorder_cache.cache_node(order.id,sorderline);
	                    var state_icon = sorderline.querySelector('.order_btn');
	                    if(state_icon){
	                    	state_icon.addEventListener('click', (function(e) {
	                    		
	                        	var order_id = e.target.dataset.item;
	                        	var order_state = ($("#"+order_id).text()).trim();
	                        	this.update_order_state(order_id, order_state);
	                        	
	                        }.bind(this)));
	                    }
	                    var del_icon = sorderline.querySelector('.del_btn');
	                    if(del_icon){
	                    	del_icon.addEventListener('click', (function(e) {
	                    		
	                        	var order_id = e.target.dataset.item;
	                        	this.delete_order(order_id);
	                        	
	                        }.bind(this)));
	                    }
	                  
	                }
	                if(j == 3){
	                	  j = 0;
	                }else{
	                	  j++;
	                }
	                contents.prepend(sorderline);
	            }
	        }
        }else{
        	self.$('.arrows').addClass("wet_display_none");
        	var firstcontents = this.$el[0].querySelector('.checkout_orders .first_orders');
        	firstcontents.innerHTML = "";
      	    var secondcontents = this.$el[0].querySelector('.checkout_orders .second_orders');
      	    secondcontents.innerHTML = "";
      	    var thirdcontents = this.$el[0].querySelector('.checkout_orders .third_orders');
      	    thirdcontents.innerHTML = "";
      	    var fourthcontents = this.$el[0].querySelector('.checkout_orders .fourth_orders');
      	    fourthcontents.innerHTML = "";

        	var opencontents = this.$el[0].querySelector('.all_checkout_orders .open_orders');
      	    opencontents.innerHTML = "";
      	    var confirmcontents = this.$el[0].querySelector('.all_checkout_orders .confirm_orders');
      	    confirmcontents.innerHTML = "";
      	    var preparecontents = this.$el[0].querySelector('.all_checkout_orders .prepare_orders');
      	    preparecontents.innerHTML = "";
      	    var readycontents = this.$el[0].querySelector('.all_checkout_orders .ready_orders');
      	    readycontents.innerHTML = "";

        	var j = 0;
        	for(var i = 0, len = Math.min(orders.length,1000); i < len; i++){
                var order    = orders[i];
                var sorderline = this.sorder_cache.get_node(order.id);

                if(j == 0){
              	  var contents = this.$el[0].querySelector('.checkout_orders .first_orders');
                }
                if(j == 1){
              	  var contents = this.$el[0].querySelector('.checkout_orders .second_orders');
                }
                if(j == 2){
              	  var contents = this.$el[0].querySelector('.checkout_orders .third_orders');
                }
                if(j == 3){
              	  var contents = this.$el[0].querySelector('.checkout_orders .fourth_orders');
                }
                if(!sorderline){
                	var orderlines = [];
                	if(this.pos.db.get_orderline_by_order(orders[i].id) != undefined){
                		orderlines = this.pos.db.get_orderline_by_order(orders[i].id);
                	}
                    var sorderline_html = QWeb.render('ShopCartOrders',{widget: this, sorder:orders[i], sorderlines:orderlines, slevel:zoomLevel});
                    var sorderline = document.createElement('div');
                    sorderline.innerHTML = sorderline_html;
                    sorderline = sorderline.childNodes[1];
                    this.sorder_cache.cache_node(order.id,sorderline);
                    var state_icon = sorderline.querySelector('.order_btn');
                    if(state_icon){
                    	state_icon.addEventListener('click', (function(e) {
                    		
                        	var order_id = e.target.dataset.item;
                        	var order_state = ($("#"+order_id).text()).trim();
                        	this.update_order_state(order_id, order_state);
                        	
                        }.bind(this)));
                    }
                    var del_icon = sorderline.querySelector('.del_btn');
                    if(del_icon){
                    	del_icon.addEventListener('click', (function(e) {
                    		
                        	var order_id = e.target.dataset.item;
                        	this.delete_order(order_id);
                        	
                        }.bind(this)));
                    }
                  
                }
                if(j == 3){
              	  j = 0;
	            }else{
	              j++;
	            }
                contents.prepend(sorderline);
            }
        }
       
    },
    

});
gui.define_screen({name:'supplier_view', widget: SOOrderScreenWidget});


});