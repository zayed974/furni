const Admin = require('../models/adminmodel');
const User = require('../models/usermodel');
const bcrypt = require('bcrypt');
const Category = require('../models/categorymodal')
const Product = require('../models/productmodal')
const Sharp = require('sharp');


const loadadmin = async(req,res)=>{
    try {
        res.render('admin-login')
    } catch (error) {
        console.log(error);
    }
}

const verifyLogin = async(req,res)=>{
    try {
        const email = req.body.email;
        const password = req.body.password;
        const adminData = await User.findOne({email:email});

        if(adminData && adminData.is_admin){
            const passwordMatch = await bcrypt.compare(password, adminData.password);
            if(passwordMatch){
                req.session.admin_id = adminData._id;
                res.redirect('/admin/dashboard')
            }else{
                res.render('admin-login',{message:"Email and password are incorrect"});
            }
        }else{
            res.render('admin-login',{message:"You are not admin"});
        }

    } catch (error) {
        console.log(error);
    }
}

const loaddashboard = async(req,res)=>{
    try {
        res.render('dashboard')
    } catch (error) {
        console.log(error);
    }
}


const loaduser = async (req, res) => {
    try {
        const userData = await User.find();
        res.render('users', { users: userData });
    } catch (error) {
        console.log(error.message);
    }
}


const loadaddcategory = async (req,res)=>{
    try {
        res.render('addcategory')
    } catch (error) {
        console.log(error);
    }
}

const addcategory = async (req, res) => {
    try {
        const name = req.body.name.trim();
        const description = req.body.description.trim();
        const isExists = await Category.findOne({ name: { $regex: '.*' + name + '.*', $options: 'i' } })

        if (!isExists) {
            const category = new Category({
                name,
                description
            })
            await category.save();
            res.redirect('/admin/category')
        }
        else {
            res.render('addcategory', { message: 'Category Name already exists' })
        }
    } catch (error) {
        console.log(error.message)
        res.render('addcategory', { message: error })
    }
}

const loadcategory = async(req,res)=>{
    try {
        const category = await Category.find({})
        res.render('categories',{category})
    } catch (error) {
        console.log(error);
    }
}


const listcategory = async (req, res) => {
    try {
      const category = req.params.id;
      const userValue = await Category.findOne({ _id: category });
      if (userValue.is_listed) {
        await Category.updateOne({ _id: user }, { $set: { is_listed: false } });
        // req.session.user_id = null;
      } else {
        await Category.updateOne({ _id: user }, { $set: { is_listed: true } });
      }
      res.json({ block: true });
    } catch (error) {
      console.log(error.message);
    }
  };
// const blockUser = async(req,res)=>{
//     try {
  
//       const user_id =  req.body.userId
//       const userData = await User.findOne({_id:user_id})
  
//       if(userData.is_blocked){
//        await User.findByIdAndUpdate({_id:user_id},{$set:{is_blocked:false}}) 
//       }else{  
//         await User.findByIdAndUpdate({_id:user_id},{$set:{is_blocked:true}})
//       }
  
//       res.json({block:true}) 
  
//     } catch (error) {
//         console.log(error.message);
//         // res.render('500Error')
//     }
//   }

const blockUser = async (req, res) => {
    try {
      const user = req.params.id;
      const userValue = await User.findOne({ _id: user });
      if (userValue.is_blocked) {
        await User.updateOne({ _id: user }, { $set: { is_blocked: false } });
        req.session.user_id = null;
      } else {
        await User.updateOne({ _id: user }, { $set: { is_blocked: true } });
      }
      res.json({ block: true });
    } catch (error) {
      console.log(error.message);
    }
  };
  
  
  
module.exports = {
    loadadmin,
    verifyLogin,
    loaddashboard,
    loaduser,
    loadaddcategory,
    addcategory,
    loadcategory,
    blockUser,

}