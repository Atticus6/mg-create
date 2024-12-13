const express = require('express');
const cors = require('cors');  // 添加这行
const puppeteer = require('puppeteer');
const path = require('path');

const app = express();
const port = 19000;

// 使用 cors 中间件
app.use(cors());

// 中间件配置
app.use(express.json());

// 静态文件服务 - 用于提供 Vue 模板页面
app.use(express.static(path.join(__dirname, 'public')));

app.get('/small/test', (req, res) => {
  console.log('收到 /small/test 请求');
  // 返回结果
  res.json({
    data:"大傻逼"
  });
});

app.post('/small/api/generate-receipt', async (req, res) => {
    let browser = null;
    try {
      const { data, purchaseType, datas, payStatus, orderStatus, name, takeawayInfo, order, orderItemProducts, orderItemDelivery, orderPayRecord } = req.body;
      // 启动浏览器
      browser = await puppeteer.launch({
        headless: true,
        defaultViewport: null,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      const page = await browser.newPage();

      // 根据 purchaseType 生成不同的 HTML
      let htmlContent = '';
      
      switch(purchaseType) {
        case 0: // 普通订单
          htmlContent = generateNormalOrderHtml(data, datas, payStatus, orderStatus, name, takeawayInfo);
          break;
        case 1: // 购卡
          htmlContent = generateMemberCardHtml(data, datas, payStatus, name);
          break;
        case 2: // 充值
          htmlContent = generateRechargeCardHtml(data, datas, payStatus, name);
          break;
        case 3: // 补打
          htmlContent = buda(order, orderItemProducts, orderItemDelivery, orderPayRecord, name);
          break;
        default:
          throw new Error('无效的订单类型');
      }
      
      await page.setContent(htmlContent, { 
        waitUntil: 'networkidle0' 
      });
  
      // 获取高度
      const height = await page.evaluate(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            const element = document.querySelector('#render-dom');
            resolve(element ? element.offsetHeight : 800);
          }, 1000);
        });
      });
  
      // 设置视口
      await page.setViewport({
        width: 300,
        height: height,
        deviceScaleFactor: 5 // 设置设备缩放因子以提高清晰度
      });
      
      // 生成截图
      const screenshot = await page.screenshot({
        encoding: 'base64',
        type: 'png',
        fullPage: true
      });
      
      // 关闭浏览器
      await browser.close();
      
      // 返回结果
      res.json({
        base64: screenshot,
        width: 380,
        height: height * 1.5
      });
  
    } catch (error) {
      console.error('生成小票失败:', error);
      
      // 确保浏览器关闭
      if (browser) {
        await browser.close();
      }
      
      res.status(500).json({
        error: error.message,
        stack: error.stack 
      });
    }
  });

  
// 补打
function buda(order, orderItemProducts, orderItemDelivery, orderPayRecord, name) {
  // 构建 HTML 内容
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>补打小票</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          font-family: 'Microsoft YaHei', Arial, sans-serif;
        }
        .render-content {
          padding: 10px;
          box-sizing: border-box;
          width: 380px;
          min-height: 420px;
          padding-bottom: 50px;
          border: 1px solid #f0f0f0;
        }
        .divider {
          border-top: 1px dashed #000;
          margin: 10rpx 0;
        }
        .render-content h4 {
          line-height: 25px;
          margin: 10px auto;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          white-space: wrap;
          overflow: hidden;
          -webkit-box-orient: vertical;
          width: 270px;
          text-align: center;
        }
        .order .list {
          font-size: 14px;
          color: #333;
          line-height: 20px;
        }
        .order .food .lists {
          margin: 5px 0;
          overflow: hidden;
        }
        .order .food .lists .tit {
          float: left;
        }
        .order .food .lists .tit .biaoti {
          line-height: 19px;
          font-size: 14px;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          overflow: hidden;
          width: 110px;
          -webkit-box-orient: vertical;
        }
        .order .food .lists .tit .remark {
          font-size: 13px;
          color: #333;
        }
        .order .food .lists .flex {
          display: flex;
          justify-content: space-between;
        }
        .order .food .lists .money {
          width: 35px;
          margin-left: 10px;
          margin-right: 20rpx;
          font-size: 14px;
          text-align: right;
          line-height: 20px;
        }
        .order .food .lists .price {
          text-align: right;
        }
        .order .sum {
          line-height: 20px;
        }
        .order .heji {
          font-size: 16px;
          font-weight: 800;
          text-align: right;
          line-height: 35px;
        }
        .flex {
          display: flex;
          justify-content: space-between;
        }
        .justify-between {
          justify-content: space-between;
          align-items: center;
        }
        .tip {
          margin-top: 10px;
          font-size: 14px;
        }
      </style>
    </head>
    <body>
      <div id="render-dom" class="render-content">
        <h4>${name}</h4>
        
        <div class="order">
          <div class="list">
            <div>交易流水：${order?.code || ''}</div>
            <div>下单时间：${order?.orderCreateDate || ''}</div>
            <div>
              ${order?.appointmentDate ? `
                ${order?.firstCategory === 2 ? '服务' : '用餐'}时间：${order?.appointmentDate || ''}
                ${order?.secondCategoryName || ''}
              ` : `
                ${order?.firstCategory === 2 ? '服务' : '用餐'}时间：${order?.mealDate || ''}
                ${order?.secondCategoryName || ''}
              `}
            </div>
            <div>补打时间：${new Date().toLocaleString()}</div>
          </div>
          <div class="divider"></div>
          <div class="food">
            ${orderItemProducts.map(item => `
              <div class="lists">
                <div class="tit">
                  <div class="biaoti">${item.productName}</div>
                  ${item.productSpecs.map(spec => `
                    <div class="remark">${spec.specName}</div>
                  `).join('')}
                </div>
                <div class="flex">
                  <div class="money">
                    <div>x ${item.productNum}</div>
                    <div style="font-size: 13px">${item.promotionSimpleDesc || ''}</div>
                  </div>
                  <div class="price">
                    <div style="font-size: 13px; text-align: right">
                      ￥${(item.originalPrice || 0).toFixed(2)}
                    </div>
                    ${item.promotionValue != null ? `
                      <div style="font-size: 13px; text-align: right">
                        -￥${Math.abs(item.discountPrice).toFixed(2)}
                      </div>
                    ` : ''}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
          <div class="divider"></div>
          <div class="sum">
            <div class="flex justify-between">
              <div style="font-size: 14px">总价</div>
              <div style="font-size: 14px">
                ￥${(order?.totalOriginalAmount || 0).toFixed(2)}
              </div>
            </div>
            <div class="flex justify-between">
              <div style="font-size: 14px">折扣</div>
              <div style="font-size: 14px">
                ${order?.totalDiscount == null || order?.totalDiscount == 0 ? '-' : `-￥${Math.abs(order?.totalDiscount).toFixed(2)}`}
              </div>
            </div>
            <div class="flex justify-between">
              <div style="font-size: 14px">抹零</div>
              <div style="font-size: 14px">
                ${order?.roundDownMoney == null || order?.roundDownMoney == 0 ? '-' : `-￥${Math.abs(order?.roundDownMoney).toFixed(2)}`}
              </div>
            </div>
          </div>
          <div class="divider"></div>
          <div class="heji">
            合计：￥${(order?.totalAmount || 0).toFixed(2)}
          </div>
          <div class="tip" style="display: ${order?.payMethodName != null ? 'block' : 'none'};">
            <div class="divider"></div>
            <div>
              ${orderPayRecord?.memberCardPayInfos != null && order?.payMethodName == '充值卡' ? `
                ${orderPayRecord.memberCardPayInfos.map(item => `
                  <div>${item.cardCategoryName}付款：￥${formatUnitPriceh(item.payMoney)}</div>
                `).join('')}
              ` : ''}
              ${orderPayRecord?.memberCardPayInfos == null && order?.payMethodName != '扫码付款' ? `
                ${order?.payMethodName}付款：￥${formatUnitPriceh(order?.totalAmount)}
              ` : ''}
            </div>
          </div>
          <div style="display: ${orderItemDelivery != null ? 'block' : 'none'};">
            <div class="divider"></div>
            <div class="personal">
              <div>${orderItemDelivery?.receiverName}</div>
              <div>${orderItemDelivery?.receiverTel}</div>
              <div>${orderItemDelivery?.receiverAddr}</div>
            </div>
          </div>
          <div style="display: ${order?.orderPayStatus == 0 ? 'block' : 'none'};">
            <div class="divider"></div>
            <div style="font-weight: 800">
              待收款：￥${formatUnitPriceh(order?.totalAmount)}
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}
// 普通订单 HTML 生成函数
function generateNormalOrderHtml(data, datas, payStatus, orderStatus, name, takeawayInfo) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>普通订单小票</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            font-family: 'Microsoft YaHei', Arial, sans-serif;
          }
          .render-content {
            padding: 10px;
            box-sizing: border-box;
            width: 380px;
            min-height: 420px;
            padding-bottom: 50px;
            border: 1px solid #f0f0f0;
          }
          .divider {
            border-top: 1px dashed #000;
            margin: 10rpx 0;
          }
          .dividers {
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            font-size: 14px;
            color: #333;
            line-height: 20px;
            padding: 0;
            margin: 0;
          }
          .dividers::before,
          .dividers::after {
            content: '';
            flex: 1;
            border-top: 1px solid #000;
            margin: 0 10px; /* 控制横线与文字的间距 */
          }
          .render-content h4 {
            line-height: 25px;
            margin: 10px auto;
            text-overflow: ellipsis;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            white-space: wrap;
            overflow: hidden;
            -webkit-box-orient: vertical;
            width: 270px;
            text-align: center;
          }
          .order .list {
            font-size: 14px;
            color: #333;
            line-height: 20px;
          }
          .order .food .lists {
            margin: 5px 0;
            overflow: hidden;
          }
          .order .food .lists .tit {
            float: left;
          }
          .order .food .lists .tit .biaoti {
            line-height: 19px;
            font-size: 14px;
            text-overflow: ellipsis;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            overflow: hidden;
            width: 110px;
            -webkit-box-orient: vertical;
          }
          .order .food .lists .tit .remark {
            font-size: 13px;
            color: #333;
          }
          .order .food .lists .flex {
            display: flex;
            justify-content: space-between;
          }
          .order .food .lists .money {
            width: 35px;
            margin-left: 10px;
            margin-right: 20rpx;
            font-size: 14px;
            text-align: right;
            line-height: 20px;
          }
          .order .food .lists .price {
            text-align: right;
          }
          .order .sum {
            line-height: 20px;
          }
          .order .heji {
            font-size: 16px;
            font-weight: 800;
            text-align: right;
            line-height: 35px;
          }
          .flex {
            display: flex;
            justify-content: space-between;
          }
          .justify-between {
            justify-content: space-between;
            align-items: center;
          }
          .vip, .personal {
            font-size: 14px;
            line-height: 1.5;
          }
          .tip{
            margin-top: 10px;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
      <div id="render-dom" class="render-content">
        <h4>${name}</h4>
        
        <div class="order">
          <div class="list">
            <div>交易流水：${datas.orderCode || ''}</div>
            <div>下单时间：${datas.orderCreateTime || ''}</div>
            <div>
              ${orderStatus.firstCategory === 2 ? '服务' : '用餐'}时间：
              ${formatDate(addDays(new Date(), data.appointmentDate)) || formatDate(addDays(new Date(), datas.orderCreateTime)) || ''}
              ${orderStatus.meals?.name || ''}
            </div>
          </div>
  
          <div class="dividers">
            ${orderStatus.isDineIn
              ? (orderStatus.firstCategory === 2 ? '到店' : '堂食')
              : (orderStatus.firstCategory === 2 ? '上门' : '外送')
            }
          </div>
  
          <div class="food">
            ${data.products ? data.products.map(item => `
              <div class="lists">
                <div class="tit">
                  <div class="biaoti">${item.productName}</div>
                  ${item.selectedSpecs ? `
                    <div class="remark">
                      ${item.selectedSpecs.map(spec => spec.specName).join(',')}
                    </div>
                  ` : ''}
                </div>
                <div class="flex">
                  <div class="money">
                    <div>x ${item.num}</div>
                    <div style="font-size: 13px">${item.promotionSimpleDesc || ''}</div>
                  </div>
                  <div class="price">
                    <div style="font-size: 13px; text-align: right">
                      ￥${(item.unitPrice || 0).toFixed(2)}
                    </div>
                    ${item.promotionAmount ? `
                      <div style="font-size: 13px; text-align: right">
                        -￥${Math.abs(item.promotionAmount).toFixed(2)}
                      </div>
                    ` : ''}
                  </div>
                </div>
              </div>
            `).join('') : ''}
          </div>
  
          <div class="divider"></div>
  
          <div class="sum">
            <div class="flex justify-between">
              <div style="font-size: 13px">总价</div>
              <div style="font-size: 13px">
                ￥${(data.totalOriginalAmount || 0).toFixed(2)}
              </div>
            </div>
            <div class="flex justify-between">
              <div style="font-size: 13px">折扣</div>
              <div style="font-size: 13px">
                ${data.totalPromotionAmount ? 
                  `-￥${Math.abs(data.totalPromotionAmount).toFixed(2)}` : 
                  '-'
                }
              </div>
            </div>
            <div class="flex justify-between">
              <div style="font-size: 13px">抹零</div>
              <div style="font-size: 13px">
                ${data.roundDownAmount ? 
                  `-￥${Math.abs(data.roundDownAmount).toFixed(2)}` : 
                  '-'
                }
              </div>
            </div>
          </div>
  
          <div class="divider"></div>
  
          <div class="heji">
            合计：￥${(data.totalAmount || 0).toFixed(2)}
          </div>
  
          ${datas.payedCard ? `
            <div class="divider"></div>
            <div class="vip">
              ${datas.payedCard[0].memberCateType === 2 || datas.payedCard[0].memberCateType === 3 ? `
                <div>${datas.payedCard[0].cardCategoryName}付款</div>
                ${datas.payedCard[0].memberCateType === 3 ? `
                  <div>${datas.payedCard[0].cardCategoryName}剩余：${datas.payedCard[0].countBalance}次</div>
                ` : ''}
                ${datas.payedCard[0].memberCateType === 2 ? `
                  <div>${datas.payedCard[0].cardCategoryName}到期时间：${datas.payedCard[0].endDate}</div>
                ` : ''}
              ` : ''}
              ${datas.payedCard[0].memberCateType === 1 || datas.payedCard[0].memberCateType === 0 ? 
                datas.payedCard.map(card => `
                  <div>${card.cardCategoryName}付款：￥${(card.payBalance || 0).toFixed(2)}</div>
                  <div>${card.cardCategoryName}余额：￥${(card.moneyBalance || 0).toFixed(2)}</div>
                `).join('') : ''
              }
            </div>
          ` : ''}
  
          ${takeawayInfo && takeawayInfo.name ? `
            <div class="divider"></div>
            <div class="personal">
              <div>${takeawayInfo.name}</div>
              <div>${takeawayInfo.telephone}</div>
              <div>${takeawayInfo.addressDetail}</div>
            </div>
          ` : ''}
  
          ${!datas.payMethod ? `
            <div class="divider"></div>
            <div style="font-weight: 800; font-size: 14px; text-align: right;">
              待收款：￥${(data.totalAmount || 0).toFixed(2)}
            </div>
          ` : ''}
  
          ${payStatus.payMethodValue ? `
            <div class="divider"></div>
            <div class="tip">
              ${payLabel(payStatus.payMethodValue, orderStatus.firstCategory)}付款：
              ￥${(data.totalAmount || 0).toFixed(2)}
            </div>
          ` : ''}
        </div>
      </div>
      </body>
      </html>
    `;
  }

//   充值
  function generateRechargeCardHtml(data, datas, payStatus, name) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>充值卡小票</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            font-family: 'Microsoft YaHei', Arial, sans-serif;
          }
          .render-content {
            padding: 10px;
            box-sizing: border-box;
            width: 380px;
            min-height: 320px;
            padding-bottom: 50px;
            border: 1px solid #f0f0f0;
          }
          .divider {
            width: 100%;
            border-top: 1px dashed #000;
            margin:5px 0;
          }
          .render-content h4 {
            line-height: 25px;
            margin: 10px auto;
            text-overflow: ellipsis;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            white-space: wrap;
            overflow: hidden;
            -webkit-box-orient: vertical;
            width: 270px;
            text-align: center;
          }
          .order .list {
            font-size: 14px;
            color: #333;
            line-height: 30px;
          }
          .heji {
            font-size: 16px;
            font-weight: 800;
            text-align: right;
            line-height: 35px;
          }
          .flex {
            display: flex;
            justify-content: space-between;
          }
          .tip{
            margin-top: 10px;
          }
        </style>
      </head>
      <body>
        <div id="render-dom" class="render-content">
          <h4>${name}</h4>
          
          <div class="order">
            <div class="list">
              <div>交易流水：${datas.orderCode || ''}</div>
              <div>交易时间：${datas.orderCreateTime || ''}</div>
              
              ${data.purchaseCard?.cardNumber ? `
                <div>充值卡号：${cardNo(data.purchaseCard.cardNumber)}</div>
              ` : ''}
              
              <div>充值金额：￥${(data.purchaseCard?.rechargeAmount || 0).toFixed(2)}</div>
              
              ${data.purchaseCard?.giveAmount && data.purchaseCard.giveAmount != 0 ? `
                <div>赠送金额：￥${(data.purchaseCard.giveAmount).toFixed(2)}</div>
              ` : ''}
              
              <div>
                充值前余额：￥${(data.purchaseCard?.price || 0).toFixed(2)}
              </div>
              
              <div>
                充值后余额：￥${(
                  (data.purchaseCard?.price || 0) + 
                  (data.purchaseCard?.rechargeAmount || 0)
                ).toFixed(2)}
              </div>
            </div>
  
            <div class="divider"></div>
  
            ${payStatus.payMethodValue ? `
              <div class="tip">
                ${payLabel(payStatus.payMethodValue)}付款：
                ￥${(data.totalAmount || 0).toFixed(2)}
              </div>
            ` : ''}
          </div>
        </div>
      </body>
      </html>
    `;
  }
  
// 购卡
function generateMemberCardHtml(data, datas, payStatus, name) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>会员卡小票</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            font-family: 'Microsoft YaHei', Arial, sans-serif;
          }
          .render-content {
            padding: 10px;
            box-sizing: border-box;
            width: 380px;
            min-height: 320px;
            padding-bottom: 50px;
            border: 1px solid #f0f0f0;
          }
          .divider {
            border-top: 1px dashed #000;
            margin: 10rpx 0;
          }
          .render-content h4 {
            line-height: 25px;
            margin: 10px auto;
            text-overflow: ellipsis;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            white-space: wrap;
            overflow: hidden;
            -webkit-box-orient: vertical;
            width: 240px;
            text-align: center;
          }
          .order .list {
            font-size: 14px;
            color: #333;
            line-height: 20px;
          }
          .heji {
            font-size: 16px;
            font-weight: 800;
            text-align: right;
            line-height: 35px;
          }
          .flex {
            display: flex;
            justify-content: space-between;
          }
          .tip{
            margin-top: 10px;
          }
        </style>
      </head>
      <body>
        <div id="render-dom" class="render-content">
          <h4>${name}</h4>
          
          <div class="order">
            <div class="list">
              <div>交易流水：${datas.orderCode || ''}</div>
              <div>交易时间：${datas.orderCreateTime || ''}</div>
              
              ${data.purchaseCard?.memberCateType === 2 ? `
                <div>包月卡：${data.purchaseCard.name || ''}</div>
                <div>服务范围：${data.purchaseCard.firstProdCategoryName || ''}</div>
                
                ${data.purchaseCard.secondProdCategoryName ? `
                  <div>服务类目：${data.purchaseCard.secondProdCategoryName}</div>
                ` : ''}
                
                ${data.purchaseCard.productName ? `
                  <div>服务项目：${data.purchaseCard.productName}</div>
                ` : ''}
                
                <div>购卡金额：￥${(data.purchaseCard.price || 0).toFixed(2)}</div>
                <div>有效天数：${data.purchaseCard.validDays || 0}</div>
                <div>开卡日期：${formatDate(new Date())}</div>
                <div>有效日期：${formatDate(addDays(new Date(), data.purchaseCard.validDays))}</div>
              ` : ''}
              
              ${data.purchaseCard?.memberCateType === 3 ? `
                <div>次卡：${data.purchaseCard.name || ''}</div>
                <div>服务范围：${data.purchaseCard.firstProdCategoryName || ''}</div>
                
                ${data.purchaseCard.secondProdCategoryName ? `
                  <div>服务类目：${data.purchaseCard.secondProdCategoryName}</div>
                ` : ''}
                
                ${data.purchaseCard.productName ? `
                  <div>服务项目：${data.purchaseCard.productName}</div>
                ` : ''}
                
                <div>购卡金额：￥${(data.purchaseCard.price || 0).toFixed(2)}</div>
                <div>次数：${data.purchaseCard.originalBalance || 0}</div>
                <div>开卡日期：${formatDate(new Date())}</div>
                <div>有效日期：${formatDate(addDays(new Date(), data.purchaseCard.validDays))}</div>
              ` : ''}
            </div>
  
            <div class="divider"></div>
  
            ${payStatus.payMethodValue ? `
              <div class="tip">
                ${payLabel(payStatus.payMethodValue)}付款：
                ￥${(data.totalAmount || 0).toFixed(2)}
              </div>
            ` : ''}
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // 辅助函数：脱敏卡号
  function cardNo(cardNumber) {
    if (!cardNumber) return '';
    return cardNumber.slice(0, 4) + '****' + cardNumber.slice(-4);
  }
  
  // 辅助函数：日期格式化
  function formatDate(date) {
    return new Date(date).toISOString().split('T')[0];
  }

  function formatUnitPriceh(data){
    return `￥${formatUnitPrice(Math.abs(data))}`
  }

  function formatUnitPrice(value){
    let num
    if (typeof value === 'number') {
      num = value
    } else {
      num = parseFloat(value)
      if (isNaN(num)) {
        return ''
      }
    }
    const numStr = strictRound(num, 3)
    // 如果第三位小数为0，则保留两位小数，否则保留三位小数
    if (numStr[numStr.length - 1] === '0') {
      return strictRound(num)
    } else {
      return numStr
    }
  }

  function strictRound(value, decimalPlaces= 2){
    const num = parseFloat(value)
    if (isNaN(num)) {
      return ''
    }
    const multiplier = Math.pow(10, decimalPlaces)
    const roundedNum = Math.round(num * multiplier) / multiplier
    return roundedNum.toFixed(decimalPlaces)
  }
  
  // 辅助函数：日期增加天数
  function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  // 支付方式处理函数
  function payLabel(prop, firstCategory = 1) {
    const payIcon = {
      ALIPAY: '支付宝',
      WECHAT: '微信',
      POS: '银联',
      CASH: '现金',
      VOUCHER: '就餐券',
      SCANPAY: '扫码'
    };
    if (firstCategory == 2 && prop == 'VOUCHER') {
      return '礼券';
    }
    return payIcon[prop] || '';
  }

app.listen(port, () => {
  console.log(`服务器运行在 http://localhost:${port}`);
});