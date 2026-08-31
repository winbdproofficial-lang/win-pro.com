const SANDBOX_INIT_URL='https://sandbox.sslcommerz.com/gwprocess/v4/api.php';
const SANDBOX_VALIDATE_URL='https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php';

function assertSandboxConfig(){
  if(process.env.SSLCOMMERZ_MODE!=='sandbox') throw new Error('SSLCOMMERZ sandbox mode is not enabled');
  if(!process.env.SSLCOMMERZ_STORE_ID||!process.env.SSLCOMMERZ_STORE_PASSWORD) throw new Error('SSLCOMMERZ sandbox credentials are not configured');
}

async function postForm(url,data){
  const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(data)});
  const text=await r.text();
  let json; try{json=JSON.parse(text);}catch{throw new Error(`SSLCOMMERZ returned invalid JSON (${r.status})`);}
  if(!r.ok) throw new Error(`SSLCOMMERZ HTTP ${r.status}`);
  return json;
}

async function initiatePayment({tranId,amount,customer,successUrl,failUrl,cancelUrl,ipnUrl}){
  assertSandboxConfig();
  const data={
    store_id:process.env.SSLCOMMERZ_STORE_ID,
    store_passwd:process.env.SSLCOMMERZ_STORE_PASSWORD,
    total_amount:Number(amount).toFixed(2),
    currency:'BDT',
    tran_id:tranId,
    product_category:'digital-service',
    product_name:'WINBD-PRO Sandbox Test Payment',
    product_profile:'non-physical-goods',
    success_url:successUrl,
    fail_url:failUrl,
    cancel_url:cancelUrl,
    ipn_url:ipnUrl,
    cus_name:(customer.fullName||customer.username||'WINBD User').slice(0,50),
    cus_email:(customer.email||'sandbox@example.com').slice(0,50),
    cus_add1:'Dhaka',
    cus_city:'Dhaka',
    cus_state:'Dhaka',
    cus_postcode:'1000',
    cus_country:'Bangladesh',
    cus_phone:(customer.phone||'01700000000').slice(0,20),
    shipping_method:'NO',
    num_of_item:'1',
    product_amount:Number(amount).toFixed(2),
    vat:'0',
    discount_amount:'0',
    convenience_fee:'0'
  };
  const result=await postForm(SANDBOX_INIT_URL,data);
  if(result.status!=='SUCCESS'||!result.GatewayPageURL) throw new Error(result.failedreason||'SSLCOMMERZ could not create a payment session');
  return result;
}

async function validatePayment(valId){
  assertSandboxConfig();
  const url=new URL(SANDBOX_VALIDATE_URL);
  url.searchParams.set('val_id',valId);
  url.searchParams.set('store_id',process.env.SSLCOMMERZ_STORE_ID);
  url.searchParams.set('store_passwd',process.env.SSLCOMMERZ_STORE_PASSWORD);
  url.searchParams.set('format','json');
  const r=await fetch(url,{method:'GET'});
  const text=await r.text();
  let json; try{json=JSON.parse(text);}catch{throw new Error(`SSLCOMMERZ validation returned invalid JSON (${r.status})`);}
  if(!r.ok) throw new Error(`SSLCOMMERZ validation HTTP ${r.status}`);
  return json;
}

module.exports={initiatePayment,validatePayment};
