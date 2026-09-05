// Standard Farm Machinery lineup supplied for Swaraj Agro.
// These entries are intentionally brand-specific so each brand appears as a separate product.
const defaultProducts = [
  {name:'Multi Crop Harvester', brand:'Fieldking', price:'₹ 2,640,000', subcategory:'Harvesting'},
  {name:'Multi Crop Thresher', brand:'Vardhman', price:'₹ 271,000', subcategory:'Threshing'},
  {name:'Rotavator', brand:'Fieldking', price:'₹ 142,000', subcategory:'Tillage'},
  {name:'Sheller cum Polisher', brand:'Surjeet', price:'₹ 200,000', subcategory:'Crop Processing'},
  {name:'Power Weeder', brand:'Alap', price:'₹ 23,000', subcategory:'Tillage & Weeding'},
  {name:'Mini Rice Mill', brand:'Annpurna', price:'₹ 20,000', subcategory:'Rice Processing'},
  {name:'Mini Rice Mill', brand:'HeavyTech', price:'₹ 22,000', subcategory:'Rice Processing'},
  {name:'Rubber Sheller', brand:'Satya Subhra Industries', price:'₹ 25,000', subcategory:'Crop Processing'},
  {name:'Rubber Sheller', brand:'Sechanam', price:'₹ 30,000', subcategory:'Crop Processing'},
  {name:'Pulverizer', brand:'Alishan', price:'₹ 18,000', subcategory:'Crop Processing'},
  {name:'Petrol PumpSet 1.5"', brand:'Bonhoeffer', price:'₹ 19,000', subcategory:'Pumps & Irrigation'},
  {name:'Petrol PumpSet 1.5"', brand:'SS Gold', price:'₹ 12,500', subcategory:'Pumps & Irrigation'},
  {name:'Petrol PumpSet 1.5"', brand:'Greeves', price:'₹ 115,100', subcategory:'Pumps & Irrigation'},
  {name:'Petrol PumpSet 1.5"', brand:'Supremoto', price:'₹ 9,500', subcategory:'Pumps & Irrigation'},
  {name:'Petrol PumpSet 2"', brand:'Bonhoeffer', price:'₹ 24,000', subcategory:'Pumps & Irrigation'},
  {name:'Petrol PumpSet 2"', brand:'Kisan Kraft', price:'₹ 13,500', subcategory:'Pumps & Irrigation'},
  {name:'Petrol PumpSet 2"', brand:'Sechanam', price:'₹ 12,500', subcategory:'Pumps & Irrigation'},
  {name:'Petrol PumpSet 3"', brand:'Sonalako Gold', price:'₹ 11,500', subcategory:'Pumps & Irrigation'},
  {name:'Petrol PumpSet 3"', brand:'Kisan Kraft', price:'₹ 15,000', subcategory:'Pumps & Irrigation'},
  {name:'Electric PumpSet 1.5" (Agriculture)', brand:'Chetak', price:'₹ 8,000', subcategory:'Pumps & Irrigation'},
  {name:'Electric PumpSet 2" (Agriculture)', brand:'Chetak', price:'₹ 11,500', subcategory:'Pumps & Irrigation'},
  {name:'Electric PumpSet 3" (Agriculture)', brand:'Chetak', price:'₹ 15,000', subcategory:'Pumps & Irrigation'},
  {name:'Electric PumpSet 1" (Home Use)', brand:'Havells', price:'₹ 6,500', subcategory:'Pumps & Irrigation'},
  {name:'Rice Puffing Machine', brand:'Satya Subhra Industries', price:'₹ 118,000', subcategory:'Rice Processing'},
  {name:'Rice Flattening Machine', brand:'Satya Subhra Industries', price:'₹ 125,000', subcategory:'Rice Processing'},
  {name:'Oil Mill', brand:'Satya Subhra Industries', price:'₹ 45,000', subcategory:'Oil Processing'},
  {name:'Paddy Thresher', brand:'Agreameate', price:'₹ 40,000', subcategory:'Threshing'},
  {name:'Power Paddy Thresher', brand:'', price:'₹ 25,500', subcategory:'Threshing'},
  {name:'Wet Grinder', brand:'Bhardwaj', price:'₹ 25,000', subcategory:'Food Processing'},
  {name:'Wet Grinder', brand:'Laxmi Agro', price:'₹ 7,000', subcategory:'Food Processing'},
  {name:'Solar Jhatka Machine', brand:'', price:'₹ 9,500', subcategory:'Farm Protection'}
].map((p,i)=>({
  id:`catalog-v1-${i+1}-${String(p.name).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')}-${String(p.brand||'generic').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'')}`,
  name:p.name,
  category:'Farm Machinery',
  subcategory:p.subcategory,
  price:p.price,
  description:p.brand
    ? `${p.name} from ${p.brand}, suitable for dependable farm operations and practical day-to-day agricultural work. Brand: ${p.brand}.`
    : `${p.name} for practical farm operations, designed to support efficient day-to-day agricultural work.`,
  featured:false,
  soldQuantity:0,
  image:''
}));

module.exports = defaultProducts;
