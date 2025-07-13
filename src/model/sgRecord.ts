
import {Model} from "sutando";


class SgRecord extends Model {
    table = 'record';

    id!: number;

    user_id!: number | null;
    model_id!: number | null;
    request_data!: string | null;
    response_data!: string | null;
    status!: string | null;

    created_at!: Date;
    updated_at!: Date;

}

export {
    SgRecord
}
