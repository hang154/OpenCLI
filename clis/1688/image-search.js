import { cli, Strategy } from '@jackwener/opencli/registry';
import { searchByImage } from '../_shared/product-image-search.js';
import { readCurrentSearchRows } from './search.js';
export const imageSearchCommand = cli({
  site: '1688', name: 'image-search', access:'read', domain:'www.1688.com',
  description:'Search official product listings using one local product image (uploads it to the marketplace)',
  strategy:Strategy.COOKIE, navigateBefore:false,
  args:[{name:'image',required:true,positional:true,help:'Local JPEG/PNG/BMP/WebP file, at most 10 MiB'},
    {name:'limit',type:'int',default:20,help:'Results to return (1–100)'}],
  columns:['rank','title','price_text','moq_text','item_url','query_image_sha256'],
  func: (page,args) => searchByImage(page,args,'1688',readCurrentSearchRows),
});
