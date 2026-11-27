import { createProgram } from './program';
import helpersSource from './python/lup_helpers.py?raw';

/** Các hàm hỗ trợ dùng chung cho mọi chương trình trong khung "Mã Python". */
export const HELPERS_PROGRAM = createProgram('lup_helpers.py', helpersSource);
