import {Model} from "sutando";


class SgModel extends Model {
    table = 'model';

    id!: number;

    name!: string | null;
    vendor_id!: number | null;  // vendor id

    created_at!: Date;
    updated_at!: Date;

}

export {
    SgModel
}