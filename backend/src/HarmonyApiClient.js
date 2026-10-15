const axios = require('axios');

const HARMONY_BASE_URL = process.env.HARMONY_API_URL || 'http://172.31.36.128:3000/api/v1/integrations';
const HARMONY_AUTH_TOKEN = process.env.HARMONY_API_TOKEN;

if (!HARMONY_AUTH_TOKEN) {
  console.error('[Harmony API] ❌ FATAL ERROR: HARMONY_API_TOKEN not found in .env file!');
  console.error('[Harmony API] Add this to your .env:');
  console.error('[Harmony API] HARMONY_API_TOKEN=your_token_here');
  process.exit(1);
}

console.log(`[Harmony API] ✅ Initialized with URL: ${HARMONY_BASE_URL}`);

// Create axios instance
const harmonyApi = axios.create({
  baseURL: HARMONY_BASE_URL,
  timeout: 10000,
});

// Force Authorization header on EVERY request
harmonyApi.interceptors.request.use((config) => {

    config.headers["Content-Type"] = "application/json";
    config.headers["Accept"] = "application/json";

    // THIS IS THE IMPORTANT CHANGE
    config.headers["Authorization"] = `ApiKey ${HARMONY_AUTH_TOKEN.trim()}`;

    console.log(`[Harmony API] ${String(config.method || 'GET').toUpperCase()} ${config.url}`);

    return config;
});

// Error handler
function handleError(err, context) {
  const status = err.response?.status;
  const data = err.response?.data;
  const message = data?.error || data?.message || err.message || 'Harmony API error';
  
  console.error(`[Harmony API] ${context} - Status: ${status}`);
  console.error(`[Harmony API] ${context} - Message:`, message);
  
  if (status === 401) {
    throw new Error(`Authentication failed (401). Check token validity.\nDetails: ${message}`);
  }
  if (status === 404) {
    const notFound = new Error('Not found (404): ' + message);
    notFound.status = 404;
    throw notFound;
  }
  if (err.code === 'ECONNREFUSED') {
    throw new Error(`Cannot connect to Harmony API at ${HARMONY_BASE_URL}. Is it running?`);
  }
  
  throw new Error(`${message} (Status: ${status})`);
}

module.exports = {
  async validateCredentials(empno, password) {
    try {
      console.log(`[Harmony API] validateCredentials: Sending request for empno=${empno}`);
      
      const response = await harmonyApi.post('/auth/validate-credentials', {
        empno,
        password,
      });
      
      const d = response.data?.data;
      // Flatten the nested structure into one object
      const payload = {
        ...d?.user,
        account_status: d?.account_status,
        roles:          d?.roles,
        division:       d?.division,
        must_change_password: d?.must_change_password,
      };
      console.log(`[Harmony API] ✅ validateCredentials: Resolved empno:`, payload?.empno);
      return payload;
    } catch (err) {
      console.error(`[Harmony API] ❌ validateCredentials: Failed`);
      console.error(`[Harmony API] Error:`, err.response?.data || err.message);
      // Only Harmony's explicit 401 invalid-credential response is counted by
      // ICT Desk. Other HTTP failures remain provider errors and never lock a
      // user account.
      if (err.response?.status === 401) return null;
      handleError(err, 'validateCredentials');
    }
  },

  async getEmployeeByEmpno(empno) {
    try {
      const response = await harmonyApi.get(`/auth/employees/${empno}`);
      // Unwrap: { success, data: { user: {...}, ... } } or { success, data: {...} }
      const d = response.data?.data;
      return d?.user ? { ...d.user, ...d } : (response.data?.data || response.data);
    } catch (err) {
      handleError(err, `getEmployeeByEmpno(${empno})`);
    }
  },

  async getAllEmployees(page = 1, limit = 20) {
    try {
      const response = await harmonyApi.get('/auth/employees', {
        params: { page, limit },
      });
      return response.data;
    } catch (err) {
      handleError(err, 'getAllEmployees');
    }
  },

  async getEmployeesBulk(empnos) {
    try {
      const response = await harmonyApi.post('/auth/employees/bulk', { empnos });
      return response.data;
    } catch (err) {
      handleError(err, 'getEmployeesBulk');
    }
  },

  async getDivisions() {
    try {
      const response = await harmonyApi.get('/lookups/divisions');
      return response.data?.data || response.data || [];
    } catch (err) {
      handleError(err, 'getDivisions');
    }
  },

  async getUnitsByDivision(divisionId) {
    try {
      const response = await harmonyApi.get('/lookups/units', {
        params: { division_id: divisionId },
      });
      return response.data?.data || response.data || [];
    } catch (err) {
      handleError(err, `getUnitsByDivision(${divisionId})`);
    }
  },

  async getOfficeLocations(divisionId = null, unitId = null) {
    try {
      const params = {};
      if (divisionId) params.division_id = divisionId;
      if (unitId) params.unit_id = unitId;

      const response = await harmonyApi.get('/lookups/office-locations', { params });
      return response.data?.data || response.data || [];
    } catch (err) {
      handleError(err, 'getOfficeLocations');
    }
  },

  async getEmployeesByFilters(filters = {}, page = 1, limit = 20) {
    try {
      const params = { page, limit };
      if (filters.divisionId) params.division_id = filters.divisionId;
      if (filters.unitName) params.unit = filters.unitName;
      else if (filters.unitId) params.unit_id = filters.unitId;
      if (filters.officeLocationId) params.office_location_id = filters.officeLocationId;

      const response = await harmonyApi.get('/auth/employees', { params });
      return response.data;
    } catch (err) {
      handleError(err, 'getEmployeesByFilters');
    }
  },

  calculateAge(birthdate) {
    if (!birthdate) return null;
    try {
      const birth = new Date(birthdate);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
      return age > 0 ? age : null;
    } catch {
      return null;
    }
  },

  formatEmployeeName(employee) {
    if (!employee) return '';
    const parts = [
      employee.first_name?.trim(),
      employee.middle_name?.trim() ? employee.middle_name.trim().charAt(0) + '.' : null,
      employee.last_name?.trim(),
      employee.suffix_name?.trim() || null,
    ].filter(Boolean);
    return parts.join(' ') || 'Employee';
  },

  transformEmployeeResponse(employee) {
    if (!employee) return null;

    const fullName = this.formatEmployeeName(employee);
    const birthdate = employee.birthdate || employee.birth_date || employee.date_of_birth || employee.birthday || null;
    const age = this.calculateAge(birthdate);

    return {
      empno: employee.empno,
      full_name: fullName,
      first_name: employee.first_name,
      middle_name: employee.middle_name,
      last_name: employee.last_name,
      email: employee.email || '',
      mobile: employee.mobile || employee.mobile_no || employee.contact_number || '',
      sex: employee.sex || employee.gender || '',
      age: age,
      birthdate,
      position_name: employee.position_name || '',
      division_name: employee.division_name || 'DSWD',
      division_code: employee.division_code || '',
      division_id: employee.division_id,
      unit_name: employee.unit_name || '',
      unit_code: employee.unit_code || '',
      unit_id: employee.unit_id,
      office_location_id: employee.office_location_id,
      area_assignment_name: employee.area_assignment_name || '',
      employment_status: employee.employment_status || '',
      account_status: employee.account_status || '',
    };
  },
};
