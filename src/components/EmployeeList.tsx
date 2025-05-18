import styles from '../css/Monitoring.module.css';
import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../firebase";

type Employee = {
  uid: string;
  name: string;
  email: string;
  phone: string;
  admin?: boolean;
};

type Props = {
  handlePageClick: (value: number, employeeId?: string) => void;
};

const EmployeeList = ({ handlePageClick }: Props) => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

useEffect(() => {
    const fetchEmployees = async () => {
      try {
        setLoading(true);
        const q = query(
          collection(db, "users"), 
          where("approved", "==", true),
          where("admin","==", false)
        );
        const querySnapshot = await getDocs(q);
        const employeeList = querySnapshot.docs.map(doc => ({
          uid: doc.id,
          name: `${doc.data().firstName} ${doc.data().surname}`, // Combine first and last name
          email: doc.data().email,
          phone: doc.data().phone || "N/A", // Handle missing phone numbers
          admin: doc.data().admin || false
        }));
        setEmployees(employeeList);
      } catch (error) {
        console.error("Error fetching employees:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchEmployees();
  }, []);

  // Filter employees based on search term
  const filteredEmployees = employees.filter(emp =>
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.phone.includes(searchTerm)
  );
  return (
    <div className={styles.EmployeeList}>
      <div className={styles.Search}>
        <input 
          type="text" 
          placeholder='Enter employee name...'
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="24" 
          height="24" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"  // Fixed: strokeWidth instead of stroke-width
          strokeLinecap="round" 
          strokeLinejoin="round" 
          className="icon icon-tabler icons-tabler-outline icon-tabler-search"
        >
          <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
          <path d="M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" />
          <path d="M21 21l-6 -6" />
        </svg>
      </div>

      {loading ? (
        <div className={styles.Loading}>Loading employees...</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.map((emp) => (
              <tr key={emp.uid}>
                <td onClick={() => handlePageClick(3, emp.uid)}> {/* Pass employee ID */}
                  {emp.name}
                </td>
                <td>{emp.email}</td>
                <td>{emp.phone}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default EmployeeList;