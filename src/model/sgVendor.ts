import { Model } from 'sutando';
import { v4 as uuid } from 'uuid';
import { inspect, InspectOptions } from 'util';

class SgVendor extends Model {
    table = 'vendor';

    id!: number;
    type!: string;
    name!: string;
    token!: string;
    url!: string;

    created_at!: Date;
    updated_at!: Date;

    [inspect.custom](depth: number, options: InspectOptions) {
        return JSON.stringify(this.toData(), null, 2);
    }
}


export {
    SgVendor
}