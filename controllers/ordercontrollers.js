const Address = require('../models/addressmodels');
const Cart = require('../models/cartmodels')
const Order = require('../models/ordermodels')
const Product = require('../models/productmodal')
const User = require('../models/usermodel')
const Razorpay = require('razorpay');
const crypto = require("crypto")

const instance = new Razorpay({
  key_id: process.env.RAZORPAY_ID_KEY,
  key_secret: process.env.RAZORPAY_SECRET_KEY
});

//Place order
const placeorder = async (req, res) => {
  try {
    const total = req.body.total
    console.log(total,"total")
    console.log(req.body);
    const userId = req.session.user_id;
    const addressIndex = !req.body.address ? 0 : req.body.address;
    const paymentMethod = req.body.payment;
    console.log(req.body,"is it getting")
    const status = paymentMethod == "COD" ? 'placed' : 'pending';
    console.log(paymentMethod, addressIndex, status, userId);

    if (!req.body.address) {
      const data = {
        fullName: req.body.fullName,
        country: req.body.country,
        housename: req.body.housename,
        state: req.body.state,
        city: req.body.city,
        pincode: req.body.pincode,
        phone: req.body.phone,
        email: req.body.email,
      };
      await Address.findOneAndUpdate(
        { user: userId },
        {
          $set: { user: userId },
          $push: { address: data },
        },
        { upsert: true, new: true }
      );
    }
    const addressData = await Address.findOne({ user: userId });
    const address = addressData.address[addressIndex];
    console.log(address);
    const cartData = await Cart.findOne({ user: userId });
    const userData = await User.findOne({_id:userId})
    console.log(cartData);

    const totalAmount = cartData.product.reduce((acc, val) => acc + val.totalPrice, 0);
    console.log(totalAmount);
    const orderItems = cartData.product.map((product) => ({
      productId: product.productId,
      quantity: product.quantity,
      price: product.price,
      totalPrice: product.quantity * product.price,
      productstatus: "placed"
    }));

    const data = new Order({
      userId: userId,
      deliveryDetails: address,
      products: orderItems,
      purchaseDate: new Date(),
      totalAmount: totalAmount,
      status: status,
      paymentMethod: paymentMethod,
    });
    const orderData = await data.save();
    const orderId = orderData._id;

    if (status == "placed") {
      for (const item of orderItems) {
        await Product.updateOne(
          { _id: item.productId },
          { $inc: { quantity: -item.quantity } }
        );
      }
      await Cart.deleteOne({ user: userId });
      res.json({orderId, placed: true });
    } else if (paymentMethod == "onlinePayment") {
      const options = {
        amount: totalAmount * 100,
        currency: "INR",
        receipt: "" + orderData._id,
      };
      console.log(options);
      instance.orders.create(options, function (err, order) {
        res.json({orderId, order });
      });
    }else{
      if(userData.wallet >= totalAmount){
        const data ={
          amount:-totalAmount,
          date:new Date()
        }
        const updateOrder = await Order.findOneAndUpdate({_id:orderData._id},{$set:{status:'placed'}})
        const updateWallet = await User.findOneAndUpdate({_id:userId},{$inc:{wallet:-totalAmount},$push:{walletHistory:data}})
        for (const cartProduct of cartData.product) {
    const product = cartProduct.productId;
    const quantity = cartProduct.quantity;

    await Product.updateOne({ _id: product }, { $inc: { quantity: -quantity } });
    await Cart.deleteOne({user:userId})
    res.json({orderId,placed:true})
      }
    }else{
      res.json({wallet:false})     
    }
    
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

//verify online payment
const verifypayment = async (req, res) => {
  try {
    const userId = req.session.user_id;
    const paymentData = req.body
    console.log(paymentData, "kitoot");
    const cartData = await Cart.findOne({ user: userId });

    const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_SECRET_KEY);
    hmac.update(paymentData.razorpay_order_id + "|" + paymentData.razorpay_payment_id);
    const hmacValue = hmac.digest("hex");

    if (hmacValue == paymentData.razorpay_signature) {
      for (const productData of cartData.product) {
        const { productId, quantity } = productData;
        await Product.updateOne({ _id: productId }, { $inc: { quantity: -quantity } });
      }
    }

    const orders = await Order.findByIdAndUpdate(
      { _id: paymentData.order.receipt },
      { $set: { status: "placed", paymentId: paymentData.payment.razorpay_payment_id } }
    );

    const orderId = orders._id
    await Cart.deleteOne({ user: userId });
    res.json({ placed: true ,orderId});
  } catch (error) {
    console.log(error.message);
  }
};

//load order details
const loadorderdetail = async (req, res) => {
  try {
    const id = req.query.id;
    const orderData = await Order.findOne({ _id: id }).populate('products.productId')
    
    res.render('orderdetails', { order: orderData })
  } catch (error) {
    console.log(error);
  }
}


//cancel product 
const cancelproduct = async (req, res) => {
  try {
    const userId = req.session.user_id;
    const productId = req.body.productId
    const orderData = await Order.findOneAndUpdate(
      { "products._id": productId },
      { $set: { "products.$.productstatus": 'cancel' } }
    );
    for (const orderProduct of orderData.products) {
      const product = orderProduct.productId;
      const quantity = orderProduct.quantity;

      await Product.updateOne({ _id: product }, { $inc: { quantity: quantity } });
    }
    if (orderData.paymentMethod != 'COD' && orderData.status != 'pending') {
      const data = {
        amount: orderData.totalAmount,
        date: new Date()
      }
      await User.findOneAndUpdate({ _id: userId }, { $inc: { wallet: orderData.totalAmount }, $push: { walletHistory: data } })
    }
    res.json({ cancel: true })
    console.log(productId, "product Id");
  } catch (error) {
    console.log(error);
  }
}


//admin side
const loadordermanagement = async(req,res)=>{
  try {
    const order = await Order.find({})
    // console.log(order);
    res.render('order',{order})
  } catch (error) {
    console.log(error);
  }
}

const loadshoworder = async(req,res)=>{
  try {
    const id = req.query.id;
    const order = await Order.findOne({_id:id}).populate('products.productId')
    res.render('showorder',{order})
  } catch (error) {
    console.log(error);
  }
}


const updatastatus = async(req,res)=>{
  try {
    const productid = req.body.productId;
    const productStatus = req.body.newStatus;
    const updatedOrder = await Order.findOneAndUpdate(
      { 
          'products._id': productid
      },
      {
          $set: {
              'products.$.productstatus': productStatus
          }
      },
      { new: true }
  );

  res.json({success:true})

    console.log(productid,productStatus,updatedOrder)
  } catch (error) {
    console.log(error);
  }
}


const returnproduct = async (req, res) => {
  try {
    const userId = req.session.user_id;
    const productId = req.body.productId
    const orderData = await Order.findOneAndUpdate(
      { "products._id": productId },
      { $set: { "products.$.productstatus": 'Return' } }
    );
    for (const orderProduct of orderData.products) {
      const product = orderProduct.productId;
      const quantity = orderProduct.quantity;

      await Product.updateOne({ _id: product }, { $inc: { quantity: quantity } });
    }
      const data = {
        amount: orderData.totalAmount,
        date: new Date()
      }
      await User.findOneAndUpdate({ _id: userId }, { $inc: { wallet: orderData.totalAmount }, $push: { walletHistory: data } })
    res.json({ cancel: true })
    console.log(productId, "product Id");
  } catch (error) {
    console.log(error);
  }
}


module.exports = {
  placeorder,
  verifypayment,
  loadorderdetail,
  cancelproduct,
  loadordermanagement,
  loadshoworder,
  updatastatus,
  returnproduct
}