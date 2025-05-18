import styles from '../css/Monitoring.module.css'
type Props = {
  handlePageClick: (value: number) => void;
};
const EmployeeList = ({ handlePageClick }: Props) => {
    const employees = [
    { name: "Alice Reyes", email: "alice@example.com", number: "09171234567" },
    { name: "John Mercado", email: "john@example.com", number: "09981234567" },
    { name: "Carla Dizon", email: "carla@example.com", number: "09221234567" },
  ];
  return(
    <div className={styles.EmployeeList}>
      <div className={styles.Search}>
         <input type="text" placeholder='Enter employee name...'/>
         <svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  className="icon icon-tabler icons-tabler-outline icon-tabler-search"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0" /><path d="M21 21l-6 -6" /></svg>
      </div>
<table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Number</th>
        </tr>
      </thead>
      <tbody>
        {employees.map((emp, index) => (
          <tr key={index}>
            <td
              onClick={() => handlePageClick(3)} // Redirect to Profile
            >
              {emp.name}
            </td>
            <td>{emp.email}</td>
            <td>{emp.number}</td>
          </tr>
        ))}
      </tbody>
    </table>

    </div>
  )
}

export default EmployeeList;